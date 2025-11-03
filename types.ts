
export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
}

export interface EPRFForm {
  incidentNumber: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  patientName: string;
  patientAge: string;
  patientGender: 'Male' | 'Female' | 'Other' | 'Unknown';
  presentingComplaint: string;
  history: string;
  allergies: string;
  medications: string;
  airway: string;
  breathing: string;
  circulation: string;
  disability: string;
  exposure: string;
  vitals: VitalSign[];
  treatment: string;
  disposal: string;
  crewMembers: string[];
}

export interface VitalSign {
  time: string;
  hr: string;
  rr: string;
  bp: string;
  spo2: string;
  gcs: string;
  temp: string;
  bg: string;
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
