import { GoogleGenAI, Type } from "@google/genai";
import { collection, doc, getDoc, setDoc, Timestamp, getDocs, query, orderBy } from "firebase/firestore";
import { db } from './firebase';
import type { EPRFForm, Patient, AiAuditResult } from '../types';
import { getUserProfile } from "./userService";
import { getGeminiClient } from './geminiService';

const anonymizeEPRF = (eprf: EPRFForm, patient: Patient): Partial<EPRFForm> => {
    const { 
        patientName, 
        patientId, 
        crewMembers, 
        createdBy, 
        ...rest 
    } = eprf;

    return {
        ...rest,
        // Anonymize identifying fields
        patientName: 'Patient',
        patientId: 'ANONYMIZED',
        patientAge: patient.dob ? String(new Date().getFullYear() - new Date(patient.dob).getFullYear()) : eprf.patientAge, // Recalculate age to be sure
        crewMembers: eprf.crewMembers.map((c, i) => ({ uid: `crew_${i}`, name: `Clinician ${i+1}` })),
        createdBy: { uid: 'creator', name: 'Lead Clinician' },
    };
};

const getJRCALCGuidelines = () => {
    // This is a simplified representation. In a real app, this might come from a document store or a larger context string.
    return `
    **JRCALC Guideline Snippets (UK Ambulance Guidelines):**
    - **Anaphylaxis (Adult):** Adrenaline 1:1000 IM (0.5mg/0.5ml). Repeat after 5 mins if no improvement. High flow oxygen. IV fluids for hypotension.
    - **Asthma (Adult, Severe):** Salbutamol 5mg nebulised. Ipratropium Bromide 500mcg nebulised. Hydrocortisone 100mg IV or Prednisolone 40-50mg PO. Consider Magnesium Sulfate IV for life-threatening cases.
    - **Hypoglycaemia (Adult):** If conscious and able to swallow, 15-20g quick-acting carbohydrate (e.g., Glucogel). If unconscious or unable to swallow, Glucagon 1mg IM or Glucose 10% IV.
    - **Chest Pain (Cardiac):** Aspirin 300mg PO. GTN spray (2 sprays/1 puff sublingually), repeat every 5 mins. Oxygen only if SpO2 < 94%. Morphine for pain relief.
    `;
};

export const performAiAudit = async (eprf: EPRFForm, managerId: string): Promise<string> => {
    const ai = await getGeminiClient({ showToasts: false });
    if (!ai) {
        throw new Error("AI client could not be initialized. API key might be missing.");
    }

    // 1. Fetch associated patient data
    const patientDoc = await getDoc(doc(db, 'patients', eprf.patientId!));
    if (!patientDoc.exists()) throw new Error("Patient not found for audit");
    const patient = { id: patientDoc.id, ...patientDoc.data() } as Patient;

    const managerProfile = await getUserProfile(managerId);
    if (!managerProfile) throw new Error("Manager profile not found");

    // 2. Anonymize data
    const anonymizedEPRF = anonymizeEPRF(eprf, patient);
    const eprfJsonString = JSON.stringify(anonymizedEPRF, null, 2);

    // 3. Prepare Prompt
    const prompt = `
    Analyze the following anonymized electronic Patient Report Form (ePRF) data.
    Your task is to act as a clinical auditor for a UK event medical company.
    Evaluate the report based on UK clinical standards (primarily JRCALC) and best practices for documentation.
    
    **CONTEXT: JRCALC GUIDELINES**
    ${getJRCALCGuidelines()}

    **ePRF DATA:**
    \`\`\`json
    ${eprfJsonString}
    \`\`\`

    Based on the provided data and guidelines, return a JSON object with the specified schema.
    Scores must be integers between 0 and 100.
    - completenessScore: How well-documented is the report? Are all relevant fields filled according to the presentation type?
    - guidelineAdherenceScore: Based on the presenting complaint and findings, was the treatment provided in line with JRCALC guidelines? Score lower if unable to determine due to poor documentation.
    - documentationScore: How clear, concise, and professional is the written documentation (narratives, history, etc.)?
    - overallScore: A weighted average of the above scores (40% adherence, 30% completeness, 30% documentation).
    - summary: A brief one-paragraph summary of the audit findings.
    - strengths: A list of 2-3 specific things that were done well (e.g., "Excellent, detailed history taking").
    - areasForImprovement: A list of 2-3 specific, constructive suggestions for improvement (e.g., "Consider documenting a full set of vital signs after administering medication.").
    - keyLearningPoints: A list of 1-2 key takeaways from this case for wider team training.
    `;

    // 4. Call Gemini API
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    completenessScore: { type: Type.INTEGER },
                    guidelineAdherenceScore: { type: Type.INTEGER },
                    documentationScore: { type: Type.INTEGER },
                    overallScore: { type: Type.INTEGER },
                    summary: { type: Type.STRING },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    areasForImprovement: { type: Type.ARRAY, items: { type: Type.STRING } },
                    keyLearningPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['completenessScore', 'guidelineAdherenceScore', 'documentationScore', 'overallScore', 'summary', 'strengths', 'areasForImprovement', 'keyLearningPoints']
            }
        }
    });

    const resultJson = JSON.parse(response.text);

    // 5. Save results
    const auditResult: Omit<AiAuditResult, 'id'> = {
        ...resultJson,
        eprfId: eprf.id!,
        patientId: eprf.patientId!,
        eventName: eprf.eventName,
        incidentDate: eprf.incidentDate,
        auditedAt: Timestamp.now(),
        auditedBy: { uid: managerId, name: `${managerProfile.firstName} ${managerProfile.lastName}` },
    };

    const auditDocRef = doc(db, 'audits', eprf.id!); // Use ePRF ID as audit ID for 1:1 mapping
    await setDoc(auditDocRef, auditResult);

    return auditDocRef.id;
};

export const getAuditResults = async (): Promise<AiAuditResult[]> => {
    const auditsCol = collection(db, 'audits');
    const q = query(auditsCol, orderBy('auditedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AiAuditResult));
}