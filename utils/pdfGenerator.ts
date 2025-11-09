import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { EPRFForm, Patient, Injury } from '../types';

// The 'jspdf-autotable' import augments the jsPDF interface automatically.
const BODY_IMAGE_ANTERIOR = 'https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Staff%20Hub/Body%20Map%20-%20Front.jpeg';
const BODY_IMAGE_POSTERIOR = 'https://145955222.fs1.hubspotusercontent-eu1.net/hubfs/145955222/AMS/Staff%20Hub/Body%20Map%20-%20Back.jpeg';


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
    const pageCount = (doc as any).internal.getNumberOfPages();
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

const addText = (doc: jsPDF, text: string | null | undefined, yPos: { y: number }, indent = 0) => {
    if (!text || text.trim() === '') return;
    checkPageBreak(doc, yPos, 10);
    const splitText = doc.splitTextToSize(text, 182 - indent);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
    doc.text(splitText, 14 + indent, yPos.y);
    yPos.y += (doc.getTextDimensions(splitText).h) + 2;
};

// Helper for injury map generation
const getMarkerStyle = (type: Injury['type']) => {
    if (type === 'IV Access' || type === 'IO Access') return { color: 'rgba(59, 130, 246, 0.9)' }; // blue-500
    if (type === 'Wound') return { color: 'rgba(239, 68, 68, 0.9)' }; // red-500
    if (type === 'Fracture') return { color: 'rgba(249, 115, 22, 0.9)' }; // orange-500
    if (type === 'Burn') return { color: 'rgba(168, 85, 247, 0.9)' }; // purple-500
    return { color: 'rgba(107, 114, 128, 0.9)' }; // gray-500
};

const generateBodyMapImage = (view: 'anterior' | 'posterior', injuries: Injury[], startingIndex: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const canvasWidth = 400;
        const canvasHeight = 800;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Could not get canvas context');

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            injuries.forEach((injury, index) => {
                const markerX = (injury.coords.x / 100) * canvas.width;
                const markerY = (injury.coords.y / 100) * canvas.height;

                const { color } = getMarkerStyle(injury.type);
                const number = startingIndex + index;

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(markerX, markerY, 12, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(number), markerX, markerY + 1);
            });

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject('Failed to load body map image');
        img.src = view === 'anterior' ? BODY_IMAGE_ANTERIOR : BODY_IMAGE_POSTERIOR;
    });
};


export const generateHandoverPdf = async (eprf: EPRFForm, patient: Patient) => {
    const doc = new jsPDF();
    const yPos = { y: 20 };

    await addHeader(doc, yPos);

    // Patient Details
    addSectionTitle(doc, 'Patient Details', yPos);
    addText(doc, `Name: ${eprf.patientName}`, yPos);
    addText(doc, `DOB: ${patient.dob} (Age: ${eprf.patientAge})`, yPos);
    addText(doc, `Gender: ${eprf.patientGender}`, yPos);
    yPos.y += 5;

    // Incident Details
    addSectionTitle(doc, 'Incident Details', yPos);
    addText(doc, `Date & Time: ${eprf.incidentDate} at ${eprf.incidentTime}`, yPos);
    addText(doc, `Location: ${eprf.incidentLocation}`, yPos);
    addText(doc, `Event: ${eprf.eventName || 'N/A'}`, yPos);
    yPos.y += 5;

    // Clinical Narrative
    addSectionTitle(doc, 'Clinical Narrative', yPos);
    addText(doc, `Presenting Complaint: ${eprf.presentingComplaint}`, yPos);
    addText(doc, `History: ${eprf.history}`, yPos);
    yPos.y += 5;
    
    // SAMPLE History
    addSectionTitle(doc, 'SAMPLE History', yPos);
    addText(doc, `Allergies: ${eprf.allergies.join(', ') || 'None known'}`, yPos);
    addText(doc, `Medications: ${eprf.medications.join(', ') || 'None'}`, yPos);
    addText(doc, `Past Medical History: ${eprf.pastMedicalHistory || 'None'}`, yPos);
    yPos.y += 5;

    // Assessment
    addSectionTitle(doc, 'Assessment Findings', yPos);
    addText(doc, `AVPU: ${eprf.disability.avpu}`, yPos);
    addText(doc, `GCS: ${eprf.disability.gcs.total} (E${eprf.disability.gcs.eyes}V${eprf.disability.gcs.verbal}M${eprf.disability.gcs.motor})`, yPos);
    if (eprf.secondarySurvey) {
        addText(doc, `Secondary Survey: ${eprf.secondarySurvey}`, yPos);
    }
    yPos.y += 5;

    // Injury Map & Details
    if (eprf.injuries && eprf.injuries.length > 0) {
        addSectionTitle(doc, 'Injury Map & Details', yPos);

        const anteriorInjuries = eprf.injuries.filter(i => i.view === 'anterior');
        const posteriorInjuries = eprf.injuries.filter(i => i.view === 'posterior');
        
        if (anteriorInjuries.length > 0) {
            checkPageBreak(doc, yPos, 75);
            const startY = yPos.y;
            const anteriorImgData = await generateBodyMapImage('anterior', anteriorInjuries, 1);
            doc.addImage(anteriorImgData, 'PNG', 14, startY, 60, 120);

            const textYPos = { y: startY };
            addText(doc, "Anterior Injuries:", textYPos, 80);
            anteriorInjuries.forEach((injury, index) => {
                addText(doc, `${index + 1}. ${injury.type}: ${injury.description}`, textYPos, 85);
            });
            
            yPos.y = Math.max(textYPos.y, startY + 125);
        }

        if (posteriorInjuries.length > 0) {
            checkPageBreak(doc, yPos, 75);
            const startY = yPos.y;
            const posteriorImgData = await generateBodyMapImage('posterior', posteriorInjuries, anteriorInjuries.length + 1);
            doc.addImage(posteriorImgData, 'PNG', 14, startY, 60, 120);

            const textYPos = { y: startY };
            addText(doc, "Posterior Injuries:", textYPos, 80);
            posteriorInjuries.forEach((injury, index) => {
                addText(doc, `${anteriorInjuries.length + index + 1}. ${injury.type}: ${injury.description}`, textYPos, 85);
            });

            yPos.y = Math.max(textYPos.y, startY + 125);
        }
    }


    // Vitals
    if(eprf.vitals.length > 0 && eprf.vitals.some(v => v.hr || v.rr || v.bp)) { // Check if vitals exist
        addSectionTitle(doc, 'Observations', yPos);
        (doc as any).autoTable({
            startY: yPos.y,
            head: [['Time', 'HR', 'RR', 'BP', 'SpO2', 'Temp', 'NEWS2']],
            body: eprf.vitals.map(v => [v.time, v.hr, v.rr, v.bp, `${v.spo2}%`, `${v.temp}°C`, v.news2 ?? 'N/A']),
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102] }, // AMS Blue
        });
        yPos.y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Treatment
    addSectionTitle(doc, 'Treatment Provided', yPos);
    if (eprf.medicationsAdministered.length > 0) {
        addText(doc, 'Medications:', yPos);
        (doc as any).autoTable({
            startY: yPos.y,
            head: [['Time', 'Medication', 'Dose', 'Route']],
            body: eprf.medicationsAdministered.map(m => [m.time, m.medication, m.dose, m.route]),
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102] },
        });
        yPos.y = (doc as any).lastAutoTable.finalY + 5;
    }
    
    if (eprf.interventions.length > 0) {
        addText(doc, 'Interventions:', yPos);
        (doc as any).autoTable({
            startY: yPos.y,
            head: [['Time', 'Intervention', 'Details']],
            body: eprf.interventions.map(i => [i.time, i.intervention, i.details]),
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102] },
        });
        yPos.y = (doc as any).lastAutoTable.finalY + 5;
    }
    
    if (eprf.medicationsAdministered.length === 0 && eprf.interventions.length === 0) {
        addText(doc, 'No specific treatment provided.', yPos);
    }
    yPos.y += 5;
    
    // Handover
    addSectionTitle(doc, 'Handover', yPos);
    addText(doc, `Disposition: ${eprf.disposition}`, yPos);
    if (eprf.disposition === 'Conveyed to ED') {
        addText(doc, `Destination: ${eprf.dispositionDetails.destination}`, yPos);
        addText(doc, `Handover to: ${eprf.dispositionDetails.handoverTo}`, yPos);
    }
    if (eprf.handoverDetails) {
        addText(doc, `Handover Notes: ${eprf.handoverDetails}`, yPos);
    }
    yPos.y += 5;

    // Crew
    addSectionTitle(doc, 'Attending Crew', yPos);
    addText(doc, eprf.crewMembers.map(c => c.name).join(', '), yPos);
    
    addFooter(doc);

    doc.save(`Handover_${patient.lastName}_${patient.firstName}_${eprf.incidentDate}.pdf`);
};
