// FIX: Changed to a default import for jsPDF, which is the correct syntax for the library.
// This allows TypeScript to correctly find and augment the module.
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { EPRFForm, Patient } from '../types';

// The 'jspdf-autotable' import augments the jsPDF interface automatically.
// No manual declaration is needed.

// Function to fetch an image and convert it to Base64
const getLogoBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching logo:", error);
        return ''; // Return an empty string on failure
    }
};

const checkPageBreak = (doc: jsPDF, yPos: { y: number }, requiredSpace: number) => {
    if (yPos.y + requiredSpace > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos.y = 20;
    }
};

const addHeader = async (doc: jsPDF, yPos: { y: number }) => {
    const logoUrl = 'https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png';
    const aegisLogoBase64 = await getLogoBase64(logoUrl);
    if (aegisLogoBase64) {
        doc.addImage(aegisLogoBase64, 'PNG', 14, yPos.y - 5, 50, 10);
    }
    doc.setFontSize(18);
    doc.text('Patient Care Report', 105, yPos.y, { align: 'center' });
    yPos.y += 15;
    doc.setLineWidth(0.5);
    doc.line(14, yPos.y - 5, 196, yPos.y - 5);
};

const addFooter = (doc: jsPDF) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
        doc.text('CONFIDENTIAL MEDICAL RECORD - Aegis Medical Solutions', 14, doc.internal.pageSize.height - 10);
    }
};

const addSectionTitle = (doc: jsPDF, title: string, yPos: { y: number }) => {
    checkPageBreak(doc, yPos, 10);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102); // AMS Blue
    doc.text(title, 14, yPos.y);
    yPos.y += 6;
};

const addText = (doc: jsPDF, text: string, yPos: { y: number }, indent = 0) => {
    checkPageBreak(doc, yPos, 10);
    const splitText = doc.splitTextToSize(text, 182 - indent);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
    doc.text(splitText, 14 + indent, yPos.y);
    yPos.y += (splitText.length * 4) + 2;
};

const addKeyValue = (doc: jsPDF, key: string, value: string | number | string[] | undefined | null, yPos: { y: number }) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        value = 'N/A';
    }
    const finalValue = Array.isArray(value) ? value.join(', ') : value.toString();
    addText(doc, `${key}: ${finalValue}`, yPos);
};


export const generateHandoverPdf = async (eprf: EPRFForm, patient: Patient) => {
  const doc = new jsPDF();
  const yPos = { y: 15 };

  await addHeader(doc, yPos);

  // --- Patient & Incident Details ---
  addSectionTitle(doc, 'Patient & Incident Details', yPos);
  doc.autoTable({
      startY: yPos.y,
      body: [
          ['Name', `${patient.firstName} ${patient.lastName}`, 'Incident Date', eprf.incidentDate],
          ['DOB / Age', `${patient.dob} (${eprf.patientAge})`, 'Incident Time', eprf.incidentTime],
          ['Gender', eprf.patientGender, 'Location', eprf.incidentLocation],
          ['Event', eprf.eventName || 'N/A', 'Incident #', eprf.incidentNumber],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 },
      didDrawPage: (data) => { yPos.y = data.cursor.y; }
  });

  // --- Type-Specific Sections ---
  if (eprf.presentationType === 'Welfare/Intox') {
      addSectionTitle(doc, 'Welfare Log', yPos);
      addKeyValue(doc, 'Presenting Situation', eprf.presentingComplaint, yPos);
      checkPageBreak(doc, yPos, 20);
      if (eprf.welfareLog?.length > 0) {
          doc.autoTable({
              startY: yPos.y,
              head: [['Time', 'Observation / Action']],
              body: eprf.welfareLog.map(item => [item.time, item.observation]),
              theme: 'grid', headStyles: { fillColor: [0, 51, 102] },
              didDrawPage: (data) => { yPos.y = data.cursor.y; }
          });
      } else {
          addText(doc, 'No welfare entries logged.', yPos);
      }
      yPos.y += 5;

  } else { // Medical/Trauma or Minor Injury
      addSectionTitle(doc, 'Clinical Narrative', yPos);
      addKeyValue(doc, 'Presenting Complaint', eprf.presentingComplaint, yPos);
      addKeyValue(doc, 'History', eprf.history, yPos);
      addKeyValue(doc, 'Mechanism of Injury', eprf.mechanismOfInjury, yPos);

      addSectionTitle(doc, 'SAMPLE History', yPos);
      doc.autoTable({
          startY: yPos.y,
          body: [
              ['Allergies', eprf.allergies.join(', ') || 'None known'],
              ['Medications', eprf.medications.join(', ') || 'None'],
              ['Past Medical History', eprf.pastMedicalHistory || 'N/A'],
              ['Last Oral Intake', eprf.lastOralIntake || 'N/A'],
          ],
          theme: 'plain', styles: { fontSize: 9, cellPadding: 1 },
          didDrawPage: (data) => { yPos.y = data.cursor.y; }
      });

      if (eprf.painAssessment && eprf.painAssessment.severity > 0) {
          addSectionTitle(doc, 'Pain Assessment (OPQRST)', yPos);
          doc.autoTable({
              startY: yPos.y,
              body: [
                  ['Onset', eprf.painAssessment.onset, 'Provocation', eprf.painAssessment.provocation],
                  ['Quality', eprf.painAssessment.quality, 'Radiation', eprf.painAssessment.radiation],
                  ['Severity', `${eprf.painAssessment.severity}/10`, 'Time', eprf.painAssessment.time],
              ],
              theme: 'plain', styles: { fontSize: 9, cellPadding: 1 },
              didDrawPage: (data) => { yPos.y = data.cursor.y; }
          });
      }

      if (eprf.presentationType === 'Medical/Trauma') {
          addSectionTitle(doc, 'Primary Survey & Disability', yPos);
          doc.autoTable({
              startY: yPos.y,
              body: [
                  ['Airway', eprf.airway, 'AVPU', eprf.disability.avpu],
                  ['Breathing', eprf.breathing, 'GCS', `${eprf.disability.gcs.total} (E${eprf.disability.gcs.eyes}V${eprf.disability.gcs.verbal}M${eprf.disability.gcs.motor})`],
                  ['Circulation', eprf.circulation, 'Pupils', eprf.disability.pupils],
                  ['Exposure', eprf.exposure, '', ''],
              ],
              theme: 'striped', styles: { fontSize: 9, cellPadding: 1 },
              didDrawPage: (data) => { yPos.y = data.cursor.y; }
          });
      }
      
      addSectionTitle(doc, 'Secondary Survey', yPos);
      addText(doc, eprf.secondarySurvey || 'No findings noted.', yPos);

      if (eprf.injuries?.length > 0) {
          addSectionTitle(doc, 'Injuries', yPos);
          for (const injury of eprf.injuries) {
              checkPageBreak(doc, yPos, 45);
              addText(doc, `${injury.view.toUpperCase()}: ${injury.description}`, yPos);
              try {
                  doc.addImage(injury.drawingDataUrl, 'PNG', 14, yPos.y, 60, 40);
                  yPos.y += 45;
              } catch (e) {
                  console.error("Failed to add injury image to PDF", e);
                  addText(doc, '[Image could not be rendered]', yPos);
              }
          }
      }
  }

  // --- Common Sections for All Types ---
  if (eprf.vitals?.length > 0 && eprf.vitals.some(v => v.hr || v.rr || v.bp)) {
      addSectionTitle(doc, 'Observations', yPos);
      checkPageBreak(doc, yPos, 20);
      doc.autoTable({
          startY: yPos.y,
          head: [['Time', 'HR', 'RR', 'BP', 'SpO2', 'Temp', 'BG', 'Pain', 'On O2', 'NEWS2']],
          body: eprf.vitals.map(v => [v.time, v.hr, v.rr, v.bp, `${v.spo2}%`, `${v.temp}°C`, v.bg, v.painScore, v.onOxygen ? 'Yes' : 'No', v.news2 ?? 'N/A']),
          theme: 'grid', headStyles: { fillColor: [0, 51, 102] },
          didDrawPage: (data) => { yPos.y = data.cursor.y; }
      });
      yPos.y += 5;
  }
  
  if (eprf.presentationType !== 'Welfare/Intox') {
      addSectionTitle(doc, 'Treatment & Interventions', yPos);
      addKeyValue(doc, 'Working Impressions', eprf.impressions, yPos);
      checkPageBreak(doc, yPos, 20);
      if (eprf.medicationsAdministered?.length > 0) {
          doc.autoTable({
              startY: yPos.y,
              head: [['Time', 'Medication', 'Dose', 'Route']],
              body: eprf.medicationsAdministered.map(m => [m.time, m.medication, m.dose, m.route]),
              theme: 'striped', headStyles: { fillColor: [0, 168, 232] },
              didDrawPage: (data) => { yPos.y = data.cursor.y; }
          });
      }
      checkPageBreak(doc, yPos, 20);
      if (eprf.interventions?.length > 0) {
          doc.autoTable({
              startY: yPos.y,
              head: [['Time', 'Intervention', 'Details']],
              body: eprf.interventions.map(i => [i.time, i.intervention, i.details]),
              theme: 'striped', headStyles: { fillColor: [0, 168, 232] },
              didDrawPage: (data) => { yPos.y = data.cursor.y; }
          });
      }
      yPos.y += 5;
  }

  addSectionTitle(doc, 'Disposition & Handover', yPos);
  addKeyValue(doc, 'Final Disposition', eprf.disposition, yPos);
  if (eprf.disposition === 'Conveyed to ED') {
      addKeyValue(doc, 'Destination', eprf.dispositionDetails.destination, yPos);
      addKeyValue(doc, 'Receiving Clinician', eprf.dispositionDetails.receivingClinician, yPos);
  } else if (eprf.disposition === 'Referred to Other Service') {
      addKeyValue(doc, 'Referral Details', eprf.dispositionDetails.referralDetails, yPos);
  }
  addKeyValue(doc, 'Handover Notes', eprf.handoverDetails, yPos);
  
  addSectionTitle(doc, 'Crew & Signatures', yPos);
  addKeyValue(doc, 'Report Author', eprf.createdBy.name, yPos);
  addKeyValue(doc, 'Attending Crew', eprf.crewMembers.map(c => c.name), yPos);
  if (eprf.reviewedBy) {
    addKeyValue(doc, 'Reviewed By', `${eprf.reviewedBy.name} on ${eprf.reviewedBy.date.toDate().toLocaleDateString()}`, yPos);
  }
  
  const addSignature = (dataUrl: string | undefined, title: string, x: number) => {
    if (dataUrl) {
      try {
        checkPageBreak(doc, yPos, 40);
        doc.text(title, x, yPos.y);
        doc.addImage(dataUrl, 'PNG', x, yPos.y + 2, 60, 30);
      } catch (e) {
        console.error("Failed to add signature image to PDF", e);
      }
    }
  };
  addSignature(eprf.clinicianSignatureUrl, 'Clinician Signature', 14);
  addSignature(eprf.patientSignatureUrl, 'Patient/Guardian Signature', 105);
  yPos.y += 40;

  addFooter(doc);

  doc.save(`pcr_${patient.lastName}_${eprf.incidentDate}.pdf`);
};
