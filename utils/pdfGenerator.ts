import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { EPRFForm, Patient } from '../types';

// Extend jsPDF with autoTable type for TypeScript
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

// A valid placeholder base64 string to replace the corrupted one.
// This is a 1x1 transparent GIF. In a real scenario, this would be the full company logo.
const aegisLogoBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const generateHandoverPdf = (eprf: EPRFForm, patient: Patient) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;

    const addTextWithWrap = (text: string | undefined | null, x: number, y: number, options: { maxWidth?: number } = {}) => {
        if (!text) return y;
        const maxWidth = options.maxWidth || doc.internal.pageSize.getWidth() - x - 14;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        // Estimate line height for font size 10 to be ~4.5
        return y + (lines.length * 4.5);
    };

    let yPos = 10;
    
    // --- Header ---
    try {
        // Add a placeholder logo. The original was corrupted.
        doc.addImage(aegisLogoBase64, 'PNG', 14, yPos, 10, 10);
        doc.setFontSize(10);
        doc.text('Aegis Medical Solutions', 26, yPos + 6.5);
    } catch (e) {
        console.error("Could not add logo to PDF:", e);
    }
    doc.setFontSize(18);
    doc.text('Patient Handover Report', doc.internal.pageSize.getWidth() - 14, yPos + 8, { align: 'right' });
    yPos += 20;

    // --- Patient and Incident Details (Two Columns) ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Details', 14, yPos);
    doc.text('Incident Details', 105, yPos);
    doc.setLineWidth(0.2);
    doc.line(14, yPos + 2, doc.internal.pageSize.getWidth() - 14, yPos + 2);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let leftY = yPos;
    doc.setFont('helvetica', 'bold'); doc.text('Name:', 14, leftY);
    doc.setFont('helvetica', 'normal'); doc.text(`${patient.firstName} ${patient.lastName}`, 45, leftY); leftY += 7;
    doc.setFont('helvetica', 'bold'); doc.text('DOB:', 14, leftY);
    doc.setFont('helvetica', 'normal'); doc.text(patient.dob, 45, leftY); leftY += 7;
    doc.setFont('helvetica', 'bold'); doc.text('Age / Gender:', 14, leftY);
    doc.setFont('helvetica', 'normal'); doc.text(`${eprf.patientAge} / ${eprf.patientGender}`, 45, leftY);

    let rightY = yPos;
    doc.setFont('helvetica', 'bold'); doc.text('Date / Time:', 105, rightY);
    doc.setFont('helvetica', 'normal'); doc.text(`${eprf.incidentDate} ${eprf.incidentTime}`, 135, rightY); rightY += 7;
    doc.setFont('helvetica', 'bold'); doc.text('Location:', 105, rightY);
    doc.setFont('helvetica', 'normal'); doc.text(eprf.incidentLocation, 135, rightY, { maxWidth: 65 }); rightY += 7;
    doc.setFont('helvetica', 'bold'); doc.text('Event:', 105, rightY);
    doc.setFont('helvetica', 'normal'); doc.text(eprf.eventName || 'N/A', 135, rightY, { maxWidth: 65 });

    yPos = Math.max(leftY, rightY) + 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Presenting Complaint:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    yPos = addTextWithWrap(eprf.presentingComplaint, 14, yPos + 5, { maxWidth: 180 });
    yPos += 5;

    // --- Tables for Clinical Information ---
    const tableConfig = {
        startY: yPos,
        theme: 'grid' as const,
        styles: { fontSize: 9, cellPadding: 1.5 },
        headStyles: { fillColor: '#003366', textColor: '#FFFFFF', fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
        didDrawPage: (data: any) => {
            yPos = data.cursor.y;
        }
    };
    
    const allergiesText = eprf.allergies.length > 0 ? eprf.allergies.join(', ') : patient.allergies || 'None Known';
    const medicationsText = eprf.medications.length > 0 ? eprf.medications.join(', ') : patient.medications || 'None';

    const sampleData = [
        ['History of Complaint', eprf.history],
        ['Allergies', allergiesText],
        ['Medications', medicationsText],
        ['Past Medical History', eprf.pastMedicalHistory || patient.medicalHistory || 'None'],
        ['Last Oral Intake', eprf.lastOralIntake || 'N/A'],
    ];

    doc.autoTable({ ...tableConfig, head: [['Clinical Assessment (SAMPLE)']], body: sampleData });
    // Fix: Cast autoTable to 'any' to access the 'previous' property.
    yPos = (doc.autoTable as any).previous.finalY + 7;

    if (eprf.painAssessment && eprf.painAssessment.severity > 0) {
        const painData = [
            ['Onset', eprf.painAssessment.onset, 'Provocation', eprf.painAssessment.provocation],
            ['Quality', eprf.painAssessment.quality, 'Radiation', eprf.painAssessment.radiation],
            ['Severity', `${eprf.painAssessment.severity}/10`, 'Time', eprf.painAssessment.time],
        ];
        doc.autoTable({ ...tableConfig, startY: yPos, head: [['Pain Assessment (OPQRST)']], body: painData, columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } } });
        // Fix: Cast autoTable to 'any' to access the 'previous' property.
        yPos = (doc.autoTable as any).previous.finalY + 7;
    }
    
    if (eprf.vitals && eprf.vitals.length > 0) {
        doc.autoTable({
            startY: yPos,
            head: [['Time', 'HR', 'RR', 'BP', 'SpO2', 'Temp', 'NEWS2']],
            body: eprf.vitals.map(v => [v.time, v.hr, v.rr, v.bp, v.spo2, v.temp, v.news2 ?? 'N/A']),
            theme: 'striped',
            headStyles: { fillColor: '#003366' },
        });
        // Fix: Cast autoTable to 'any' to access the 'previous' property.
        yPos = (doc.autoTable as any).previous.finalY + 7;
    }

    if (eprf.medicationsAdministered && eprf.medicationsAdministered.length > 0) {
        doc.autoTable({
            startY: yPos,
            head: [['Time', 'Medication', 'Dose', 'Route']],
            body: eprf.medicationsAdministered.map(m => [m.time, m.medication, m.dose, m.route]),
            theme: 'striped',
            headStyles: { fillColor: '#003366' },
        });
        // Fix: Cast autoTable to 'any' to access the 'previous' property.
        yPos = (doc.autoTable as any).previous.finalY + 7;
    }

    if (eprf.interventions && eprf.interventions.length > 0) {
        doc.autoTable({
            startY: yPos,
            head: [['Time', 'Intervention', 'Details']],
            body: eprf.interventions.map(i => [i.time, i.intervention, i.details]),
            theme: 'striped',
            headStyles: { fillColor: '#003366' },
        });
        // Fix: Cast autoTable to 'any' to access the 'previous' property.
        yPos = (doc.autoTable as any).previous.finalY + 7;
    }

    // --- Disposition & Handover ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Disposition & Handover', 14, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    let finalY = yPos;
    finalY = addTextWithWrap(`Final Disposition: ${eprf.disposition}`, 14, finalY);
    if (eprf.disposition === 'Conveyed to ED') {
        finalY = addTextWithWrap(`Destination: ${eprf.dispositionDetails.destination}`, 14, finalY);
        finalY = addTextWithWrap(`Receiving Clinician: ${eprf.dispositionDetails.receivingClinician}`, 14, finalY);
    }
    finalY = addTextWithWrap('Handover Details:', 14, finalY);
    addTextWithWrap(eprf.handoverDetails, 14, finalY, { maxWidth: 180 });

    // --- Footer with Page Numbers ---
    const pageCount = (doc.internal as any).getNumberOfPages();
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, pageHeight - 10);
        doc.text(`Handover - ${patient.lastName}, ${patient.firstName}`, 14, pageHeight - 10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, pageHeight - 5);
    }

    doc.save(`Handover-${patient.lastName},${patient.firstName}-${eprf.incidentDate}.pdf`);
};