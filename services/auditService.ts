

// FIX: Use compat firestore and functions syntax.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db, functions } from './firebase';
import type { EPRFForm, Patient, AiAuditResult } from '../types';
import { getUserProfile } from "./userService";

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
    // FIX: Use compat httpsCallable
    const askClinicalAssistant = functions.httpsCallable('askClinicalAssistant');

    // 1. Fetch associated patient data
    // FIX: Use compat 'get' and 'doc' functions.
    const patientDoc = await db.collection('patients').doc(eprf.patientId!).get();
    if (!patientDoc.exists) throw new Error("Patient not found for audit");
    const patient = { id: patientDoc.id, ...patientDoc.data() } as Patient;

    const managerProfile = await getUserProfile(managerId);
    if (!managerProfile) throw new Error("Manager profile not found");

    // 2. Anonymize data
    const anonymizedEPRF = anonymizeEPRF(eprf, patient);
    const eprfJsonString = JSON.stringify(anonymizedEPRF, null, 2);

    // 3. Prepare Prompt
    const prompt = `
    Analyze the following anonymized electronic Patient Report Form (ePRF) data.
    Your task is to act as a clinical auditor for a UK event medical provider.
    Evaluate the report based on UK clinical standards (primarily JRCALC) and best practices for documentation.
    
    **CONTEXT: JRCALC GUIDELINES**
    ${getJRCALCGuidelines()}

    **ePRF DATA:**
    \`\`\`json
    ${eprfJsonString}
    \`\`\`

    Based on the provided data and guidelines, your response MUST be a single, valid JSON object and nothing else. Do not wrap it in markdown backticks or any other text.
    The JSON object schema must be:
    {
        "completenessScore": number (0-100),
        "guidelineAdherenceScore": number (0-100),
        "documentationScore": number (0-100),
        "overallScore": number (0-100, weighted average: 40% adherence, 30% completeness, 30% documentation),
        "summary": string (one-paragraph summary),
        "strengths": string[] (2-3 specific strengths),
        "areasForImprovement": string[] (2-3 specific, constructive suggestions),
        "keyLearningPoints": string[] (1-2 key takeaways)
    }
    `;

    // 4. Call Cloud Function
    const result = await askClinicalAssistant({ query: prompt });
    let resultJson;
    try {
        resultJson = JSON.parse((result.data as { response: string }).response);
    } catch (e) {
        console.error("Failed to parse AI audit response:", (result.data as { response: string }).response, e);
        throw new Error("AI assistant returned an invalid response.");
    }
    

    // 5. Save results
    const auditResult: Omit<AiAuditResult, 'id'> = {
        ...resultJson,
        eprfId: eprf.id!,
        patientId: eprf.patientId!,
        eventName: eprf.eventName,
        incidentDate: eprf.incidentDate,
        // FIX: Use compat 'Timestamp'.
        auditedAt: firebase.firestore.Timestamp.now(),
        auditedBy: { uid: managerId, name: `${managerProfile.firstName} ${managerProfile.lastName}` },
    };

    // FIX: Use compat 'doc' and 'set' functions.
    const auditDocRef = db.collection('audits').doc(eprf.id!); // Use ePRF ID as audit ID for 1:1 mapping
    await auditDocRef.set(auditResult);

    return auditDocRef.id;
};

export const getAuditResults = async (): Promise<AiAuditResult[]> => {
    // FIX: Use compat firestore methods.
    const auditsCol = db.collection('audits');
    const q = auditsCol.orderBy('auditedAt', 'desc');
    const snapshot = await q.get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AiAuditResult));
};