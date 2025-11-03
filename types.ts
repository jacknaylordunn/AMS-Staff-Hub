
export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: 'Medic' | 'First Responder' | 'Welfare' | 'Admin';
}

export interface Patient {
    id: string;
    nhsNumber?: string;
    firstName: string;
    lastName: string;
    dob: string;
    gender: 'Male' | 'Female' | 'Other' | 'Unknown';
    address: string;
    allergies: string;
    medications: string;
    medicalHistory: string;
}

export interface EventLog {
    id: string;
    name: string;
    date: string;
    location: string;
}

export interface EPRFForm {
  // Linking IDs
  patientId: string | null;
  eventId: string | null;
  
  // Incident
  incidentNumber: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  
  // Patient Demographics (will be populated from Patient object)
  patientName: string;
  patientAge: string;
  patientGender: 'Male' | 'Female' | 'Other' | 'Unknown';
  
  // Clinical
  presentingComplaint: string;
  history: string;
  mechanismOfInjury?: string;
  
  // SAMPLE history
  allergies: string;
  medications: string;
  pastMedicalHistory: string;

  // Primary Survey (ABCDE)
  airway: string;
  breathing: string;
  circulation: string;
  disability: {
    avpu: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
    gcs: {
        eyes: number;
        verbal: number;
        motor: number;
        total: number;
    };
    pupils: string;
  };
  exposure: string;
  
  // Vitals & Secondary Survey
  vitals: VitalSign[];
  secondarySurvey: string;
  
  // Treatment & Handover
  treatment: string;
  disposal: string;
  handoverDetails: string;

  // Crew
  crewMembers: { uid: string; name: string; }[];
}

export interface VitalSign {
  time: string;
  hr: string;
  rr: string;
  bp: string;
  spo2: string;
  gcs: string; // Kept for quick entry, main GCS is in disability
  temp: string;
  bg: string;
  news2?: string;
}

export interface Document {
  id: string;
  title: string;
  category: 'SOP' | 'Guideline' | 'Procedure';
  url: string;
  version: string;
}

export interface Shift {
  id: string;
  title: string;
  start: Date;
  end: Date;
  role: string;
}
