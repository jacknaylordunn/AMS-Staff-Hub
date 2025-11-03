import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: 'Paramedic' | 'EMT' | 'Nurse' | 'First Aider' | 'Welfare' | 'Manager' | 'Admin';
  registrationNumber?: string;
}

export interface Patient {
    id?: string;
    nhsNumber?: string;
    firstName: string;
    lastName: string;
    dob: string;
    gender: 'Male' | 'Female' | 'Other' | 'Unknown';
    address: string;
    allergies: string;
    medications: string;
    medicalHistory: string;
    createdAt: firebase.firestore.Timestamp;
}

export interface EventLog {
    id?: string;
    name: string;
    date: string;
    location: string;
    status: 'Upcoming' | 'Active' | 'Completed';
}

export interface EPRFForm {
  id?: string;
  status?: 'Draft' | 'Pending Review' | 'Reviewed';
  // Linking IDs
  patientId: string | null;
  eventId: string | null;
  eventName: string | null;
  
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
  injuries: Injury[];

  // Treatment & Handover
  medicationsAdministered: MedicationAdministered[];
  interventions: Intervention[];
  disposal: string;
  handoverDetails: string;

  // Crew & Timestamps
  crewMembers: { uid: string; name: string; }[];
  createdAt: firebase.firestore.Timestamp;
  createdBy: { uid: string; name: string; };
  reviewedBy?: { uid: string; name: string; date: firebase.firestore.Timestamp; };
}

export interface VitalSign {
  time: string;
  hr: string;
  rr: string;
  bp: string;
  spo2: string;
  temp: string;
  bg: string;
  painScore: string;
  avpu: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
  onOxygen: boolean;
  news2?: number;
}


export interface MedicationAdministered {
    id: string; // for key prop
    time: string;
    medication: string;
    dose: string;
    route: 'PO' | 'IV' | 'IM' | 'SC' | 'SL' | 'PR' | 'Nebulised' | 'Other';
}

export interface Intervention {
    id: string; // for key prop
    time: string;
    intervention: string;
    details: string;
}

export interface Injury {
    id: string;
    location: string; // e.g. 'Head (Anterior)'
    locationId: string; // e.g. 'head-ant' for SVG path id
    description: string;
}

export interface CompanyDocument {
  id: string;
  title: string;
  category: 'SOP' | 'Guideline' | 'Procedure';
  url: string;
  version: string;
}

export interface Shift {
  id?: string;
  eventId: string;
  eventName: string;
  start: firebase.firestore.Timestamp;
  end: firebase.firestore.Timestamp;
  assignedStaff: { uid: string; name: string; }[];
  roleRequired: string;
  notes?: string;
}