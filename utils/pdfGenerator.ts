import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { EPRFForm, Patient } from '../types';

export const generateHandoverPdf = (eprf: EPRFForm, patient: Patient) => {
    const doc = new jsPDF();
    let y = 15; // vertical position

    const addTitle = (title: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(title, 10, y);
        doc.setLineWidth(0.5);
        doc.line(10, y + 2, 200, y + 2);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
    };

    const addField = (label: string, value: string | number | null | undefined, options: { isMultiLine?: boolean } = {}) => {
        if (y > 280) { // check for new page
            doc.addPage();
            y = 15;
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 15, y);
        doc.setFont('helvetica', 'normal');
        const text = String(value || 'N/A');
        const splitText = doc.splitTextToSize(text, 150);
        doc.text(splitText, 50, y);
        y += (splitText.length * 4.5) + (options.isMultiLine ? 4 : 2);
    };
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Aegis Medical Solutions - ePRF Handover', 105, 10, { align: 'center' });

    // Incident and Patient Details
    addTitle('Incident & Patient Information');
    addField('Incident Number', eprf.incidentNumber);
    addField('Date & Time', `${eprf.incidentDate} ${eprf.incidentTime}`);
    addField('Location', eprf.incidentLocation);
    addField('Patient Name', `${patient.firstName} ${patient.lastName}`);
    addField('Date of Birth', patient.dob);
    addField('Age', eprf.patientAge);
    addField('Gender', patient.gender);
    addField('Allergies', patient.allergies);
    addField('Current Meds', patient.medications);
    addField('Medical History', patient.medicalHistory, { isMultiLine: true });
    y += 5;

    // Clinical
    addTitle('Clinical Findings');
    addField('Presenting Complaint', eprf.presentingComplaint, { isMultiLine: true });
    addField('History of Complaint', eprf.history, { isMultiLine: true });
    addField('Primary Survey', `A: ${eprf.airway}\nB: ${eprf.breathing}\nC: ${eprf.circulation}\nE: ${eprf.exposure}`, { isMultiLine: true });
    addField('Disability (GCS)', `AVPU: ${eprf.disability.avpu} | GCS: ${eprf.disability.gcs.total} (E${eprf.disability.gcs.eyes}V${eprf.disability.gcs.verbal}M${eprf.disability.gcs.motor}) | Pupils: ${eprf.disability.pupils}`);
    addField('Secondary Survey', eprf.secondarySurvey, { isMultiLine: true });
    if(eprf.injuries && eprf.injuries.length > 0) {
        const injuryText = eprf.injuries.map(i => `- ${i.location}: ${i.description}`).join('\n');
        addField('Specific Injuries', injuryText, { isMultiLine: true });
    }
    y += 5;

    // Observations
    addTitle('Observations');
    const vitalsHeaders = ["Time", "HR", "RR", "BP", "SpO2", "Temp", "Pain", "O2?", "NEWS2"];
    const vitalsBody = eprf.vitals.map(v => [v.time, v.hr, v.rr, v.bp, v.spo2, v.temp, v.painScore, v.onOxygen ? 'Y' : 'N', v.news2 ?? 'N/A']);
    // @ts-ignore - jspdf types might not match perfectly
    doc.autoTable({
        head: [vitalsHeaders],
        body: vitalsBody,
        startY: y,
        theme: 'striped',
        headStyles: { fillColor: [0, 51, 102] }, // AMS Blue
    });
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
    
    // Interventions & Meds
    addTitle('Interventions & Medications');
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
    
    // Handover
    addTitle('Disposal & Handover');
    addField('Disposal Plan', eprf.disposal);
    addField('Handover To', eprf.handoverDetails, { isMultiLine: true });
    addField('Crew', eprf.crewMembers.map(c => c.name).join(', '));
    addField('Report Generated', new Date().toLocaleString());

    doc.save(`ePRF_${eprf.incidentNumber}_${patient.lastName}.pdf`);
};