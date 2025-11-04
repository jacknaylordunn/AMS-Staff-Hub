import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { EPRFForm, Patient } from '../types';

export const generateHandoverPdf = (eprf: EPRFForm, patient: Patient) => {
    const doc = new jsPDF();
    let y = 15; // vertical position

    const addTitle = (title: string) => {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(title, 10, y);
        doc.setLineWidth(0.5);
        doc.line(10, y + 2, 200, y + 2);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
    };

    const addField = (label: string, value: string | number | null | undefined | string[] | boolean, options: { isMultiLine?: boolean } = {}) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return; // Don't print empty fields
        if (y > 280) { doc.addPage(); y = 15; }
        
        const text = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join(', ') : String(value);
        const splitText = doc.splitTextToSize(text, 150);

        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 15, y);
        doc.setFont('helvetica', 'normal');
        doc.text(splitText, 50, y);
        y += (splitText.length * 4.5) + (options.isMultiLine ? 4 : 2);
    };
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Aegis Medical Solutions - ePRF Handover', 105, 10, { align: 'center' });

    // Incident and Patient Details
    addTitle('Incident & Patient Information');
    addField('Presentation Type', eprf.presentationType);
    addField('Incident Number', eprf.incidentNumber);
    addField('Date', eprf.incidentDate);
    addField('Time of Call', eprf.timeOfCall);
    addField('Time on Scene', eprf.onSceneTime);
    addField('Time at Patient', eprf.atPatientTime);
    addField('Time Left Scene', eprf.leftSceneTime);
    addField('Time at Destination', eprf.atDestinationTime);
    addField('Time Clear', eprf.clearDestinationTime);
    addField('Location', eprf.incidentLocation, { isMultiLine: true });
    addField('Patient Name', `${patient.firstName} ${patient.lastName}`);
    addField('Date of Birth', patient.dob);
    addField('Age', eprf.patientAge);
    addField('Gender', patient.gender);
    y += 5;
    
    if(eprf.presentationType === 'Welfare/Intox') {
         addTitle('Welfare Assessment');
         addField('Presenting Situation', eprf.presentingComplaint, { isMultiLine: true });
         if(eprf.welfareLog?.length > 0) {
             // @ts-ignore
            doc.autoTable({
                head: [["Time", "Observation / Action"]],
                body: eprf.welfareLog.map(item => [item.time, item.observation]),
                startY: y, theme: 'striped', headStyles: { fillColor: [0, 51, 102] },
            });
            // @ts-ignore
            y = doc.lastAutoTable.finalY + 10;
         }
    } else {
        // Clinical
        addTitle('Clinical Assessment');
        addField('Presenting Complaint', eprf.presentingComplaint, { isMultiLine: true });
        addField('History of Complaint', eprf.history, { isMultiLine: true });
        addField('Allergies', patient.allergies);
        addField('Current Meds', patient.medications);
        addField('Medical History', patient.medicalHistory, { isMultiLine: true });
        
        const pa = eprf.painAssessment;
        if(pa.onset || pa.provocation || pa.quality || pa.radiation || pa.time || pa.severity > 0) {
            addField('Pain (OPQRST)', `O: ${pa.onset}, P: ${pa.provocation}, Q: ${pa.quality}, R: ${pa.radiation}, S: ${pa.severity}/10, T: ${pa.time}`, {isMultiLine: true});
        }
        
        if (eprf.presentationType === 'Medical/Trauma') {
            addField('Primary Survey', `A: ${eprf.airway}\nB: ${eprf.breathing}\nC: ${eprf.circulation}\nE: ${eprf.exposure}`, { isMultiLine: true });
            addField('Disability (GCS)', `AVPU: ${eprf.disability.avpu} | GCS: ${eprf.disability.gcs.total} (E${eprf.disability.gcs.eyes}V${eprf.disability.gcs.verbal}M${eprf.disability.gcs.motor}) | Pupils: ${eprf.disability.pupils}`);
        }
        addField('Secondary Survey', eprf.secondarySurvey, { isMultiLine: true });
        if(eprf.injuries && eprf.injuries.length > 0) {
            const injuryText = eprf.injuries.map(i => `- ${i.location}: ${i.description}`).join('\n');
            addField('Specific Injuries', injuryText, { isMultiLine: true });
        }
        y += 5;

        // Observations
        addTitle('Observations');
        const vitalsHeaders = ["Time", "HR", "RR", "BP", "SpO2", "Temp", "Pain", "O2?", eprf.presentationType === 'Medical/Trauma' ? "NEWS2" : ""];
        const vitalsBody = eprf.vitals.map(v => {
            const row = [v.time, v.hr, v.rr, v.bp, v.spo2, v.temp, v.painScore, v.onOxygen ? 'Y' : 'N'];
            if (eprf.presentationType === 'Medical/Trauma') {
                // Fix: Convert number to string to match the inferred array type.
                row.push(String(v.news2 ?? 'N/A'));
            }
            return row;
        });
        // @ts-ignore
        doc.autoTable({ head: [vitalsHeaders], body: vitalsBody, startY: y, theme: 'striped', headStyles: { fillColor: [0, 51, 102] } });
        // @ts-ignore
        y = doc.lastAutoTable.finalY + 10;

        addTitle('Impressions & Interventions');
        addField('Impressions', eprf.impressions);

        // Interventions & Meds
        if(eprf.interventions?.length > 0) {
            addField('Interventions', eprf.interventions.map(i => `${i.time} - ${i.intervention}: ${i.details}`).join('\n'), { isMultiLine: true });
        } else {
             addField('Interventions', 'None');
        }
        if(eprf.medicationsAdministered?.length > 0) {
            addField('Medications Given', eprf.medicationsAdministered.map(m => `${m.time} - ${m.medication} ${m.dose} (${m.route})`).join('\n'), { isMultiLine: true });
        } else {
            addField('Medications Given', 'None');
        }
         y += 5;
    }
    
    // Safeguarding & Capacity
    addTitle('Safeguarding & Mental Capacity');
    addField('Safeguarding Concerns', eprf.safeguarding.concerns);
    addField('Safeguarding Details', eprf.safeguarding.details, { isMultiLine: true });
    addField('Capacity Assessed', eprf.mentalCapacity.assessment);
    addField('Capacity Outcome', eprf.mentalCapacity.outcome);
    addField('Capacity Details', eprf.mentalCapacity.details, { isMultiLine: true });

    // Refusal of Care
    if (eprf.disposition === 'Left at Home (Against Advice)' && eprf.refusalOfCare) {
        addTitle('Refusal of Care');
        addField('Refused Treatment', eprf.refusalOfCare.refusedTreatment);
        addField('Refused Transport', eprf.refusalOfCare.refusedTransport);
        addField('Risks Explained to Patient', eprf.refusalOfCare.risksExplained);
        addField('Capacity Demonstrated', eprf.refusalOfCare.capacityDemonstrated);
        addField('Details', eprf.refusalOfCare.details, { isMultiLine: true });
    }
    
    // Handover
    addTitle('Disposition & Handover');
    addField('Disposition', eprf.disposition);
    if (eprf.disposition === 'Conveyed to ED' && eprf.dispositionDetails) {
        addField('Destination', eprf.dispositionDetails.destination);
        addField('Receiving Clinician', eprf.dispositionDetails.receivingClinician);
    }
    if (eprf.disposition === 'Referred to Other Service' && eprf.dispositionDetails) {
        addField('Referral Details', eprf.dispositionDetails.referralDetails, { isMultiLine: true });
    }
    addField('Handover Notes', eprf.handoverDetails, { isMultiLine: true });
    addField('Crew', eprf.crewMembers.map(c => c.name).join(', '));
    addField('Report Generated', new Date().toLocaleString());

    doc.save(`ePRF_${eprf.incidentNumber}_${patient.lastName}.pdf`);
};
