

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { EPRFForm, Patient } from '../types';

// Extend jsPDF with the autoTable plugin's type definitions
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

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


export const generateHandoverPdf = async (eprf: EPRFForm, patient: Patient) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  let yPos = 15; // Initial Y position

  const logoUrl = 'https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Logo%20FINAL%20(2).png';
  const aegisLogoBase64 = await getLogoBase64(logoUrl);

  // Header
  if (aegisLogoBase64) {
      doc.addImage(aegisLogoBase64, 'PNG', 14, yPos - 5, 50, 10);
  }
  doc.setFontSize(18);
  doc.text('Patient Handover Report', 105, yPos, { align: 'center' });
  yPos += 15;
  doc.setLineWidth(0.5);
  doc.line(14, yPos - 5, 196, yPos - 5);


  // Patient Details
  doc.setFontSize(12);
  doc.text('Patient Details', 14, yPos);
  yPos += 6;
  doc.setFontSize(10);
  doc.text(`Name: ${patient.firstName} ${patient.lastName}`, 14, yPos);
  doc.text(`DOB: ${patient.dob} (Age: ${eprf.patientAge})`, 105, yPos);
  yPos += 5;
  doc.text(`Gender: ${eprf.patientGender}`, 14, yPos);
  yPos += 10;

  // Incident Details
  doc.setFontSize(12);
  doc.text('Incident Details', 14, yPos);
  yPos += 6;
  doc.setFontSize(10);
  doc.text(`Date: ${eprf.incidentDate} at ${eprf.incidentTime}`, 14, yPos);
  doc.text(`Location: ${eprf.incidentLocation}`, 105, yPos);
  yPos += 5;
  doc.text(`Event: ${eprf.eventName}`, 14, yPos);
  yPos += 10;


  // Clinical Handover (SBAR format)
  const handoverSections = [
    { title: 'Situation / Presenting Complaint', content: eprf.presentingComplaint },
    { title: 'Background / History', content: eprf.history },
    { title: 'Assessment', content: eprf.handoverDetails || 'See detailed sections.' },
  ];
  
  handoverSections.forEach(section => {
      doc.setFontSize(12);
      doc.text(section.title, 14, yPos);
      yPos += 5;
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(section.content, 182);
      doc.text(splitText, 14, yPos);
      yPos += (splitText.length * 4) + 5;
  });

  // Function to add a new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  checkPageBreak(30);

  // Vital Signs Table
  if (eprf.vitals.length > 0) {
    doc.autoTable({
      startY: yPos,
      head: [['Time', 'HR', 'RR', 'BP', 'SpO2', 'Temp', 'NEWS2']],
      body: eprf.vitals.map(v => [v.time, v.hr, v.rr, v.bp, `${v.spo2}%`, `${v.temp}°C`, v.news2 ?? 'N/A']),
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 51, 102] }, // AMS Blue
      didDrawPage: (data) => {
        yPos = data.cursor?.y ?? yPos;
      }
    });
    yPos += 10;
  }
  
  checkPageBreak(30);

  // Medications & Interventions
  if (eprf.medicationsAdministered.length > 0 || eprf.interventions.length > 0) {
     doc.setFontSize(12);
     doc.text('Treatment Given', 14, yPos);
     yPos += 6;

     if (eprf.medicationsAdministered.length > 0) {
        doc.autoTable({
            startY: yPos,
            head: [['Time', 'Medication', 'Dose', 'Route']],
            body: eprf.medicationsAdministered.map(m => [m.time, m.medication, m.dose, m.route]),
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 168, 232] }, // AMS Light Blue
            didDrawPage: (data) => {
                yPos = data.cursor?.y ?? yPos;
            }
        });
     }
     
     if (eprf.interventions.length > 0) {
        doc.autoTable({
            startY: yPos,
            head: [['Time', 'Intervention', 'Details']],
            body: eprf.interventions.map(i => [i.time, i.intervention, i.details]),
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [0, 168, 232] },
             didDrawPage: (data) => {
                yPos = data.cursor?.y ?? yPos;
            }
        });
     }
     yPos += 5;
  }
  
  checkPageBreak(20);

  // Final Details
  doc.setFontSize(10);
  doc.text(`Disposition: ${eprf.disposition}`, 14, yPos);
  yPos += 7;
  doc.text(`Report Author: ${eprf.createdBy.name}`, 14, yPos);
  yPos += 5;
  const crewString = `Attending Crew: ${eprf.crewMembers.map(c => c.name).join(', ')}`;
  doc.text(crewString, 14, yPos);
  
  // Add page numbers
  // FIX: Replaced incorrect internal methods with the correct public API method doc.getNumberOfPages().
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width - 20,
        doc.internal.pageSize.height - 10,
        { align: 'right' }
    );
  }

  // Save the PDF
  doc.save(`handover_${patient.lastName}_${eprf.incidentDate}.pdf`);
};