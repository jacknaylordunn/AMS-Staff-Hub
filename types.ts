import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role?: 'Pending' | 'First Aider' | 'FREC3' | 'FREC4/ECA' | 'FREC5/EMT/AAP' | 'Paramedic' | 'Nurse' | 'Doctor' | 'Welfare' | 'Admin' | 'Manager';
  registrationNumber?: string;
  createdAt?: Timestamp;
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
    createdAt: Timestamp;
}

export interface EventLog {
    id?: string;
    name: string;
    date: string;
    location: string;
    status?: 'Upcoming' | 'Active' | 'Completed';
}

export interface AuditEntry {
  timestamp: Timestamp;
  user: {
    uid: string;
    name: string;
  };
  action: string;
  details?: string;
}

export interface Attachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  description: string;
}


export interface EPRFForm {
  id?: string;
  status?: 'Draft' | 'Pending Review' | 'Reviewed';
  // Linking IDs
  patientId: string | null;
  eventId: string | null;
  eventName: string | null;

  presentationType: 'Medical/Trauma' | 'Minor Injury' | 'Welfare/Intox';
  
  // Incident
  incidentNumber: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  timeOfCall?: string;
  onSceneTime?: string;
  atPatientTime?: string;
  leftSceneTime?: string;
  atDestinationTime?: string;
  clearDestinationTime?: string;
  
  // Patient Demographics
  patientName: string;
  patientAge: string;
  patientGender: 'Male' | 'Female' | 'Other' | 'Unknown';
  
  // Clinical
  presentingComplaint: string;
  history: string;
  mechanismOfInjury?: string;
  
  // SAMPLE history
  allergies: string[];
  medications: string[];
  pastMedicalHistory: string;
  lastOralIntake: string;
  
  painAssessment: {
    onset: string;
    provocation: string;
    quality: string;
    radiation: string;
    severity: number;
    time: string;
  };

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

  // Treatment & Disposition
  impressions: string[];
  medicationsAdministered: MedicationAdministered[];
  interventions: Intervention[];
  itemsUsed: string[];
  disposal?: string; // Legacy field, replaced by disposition
  disposition: 'Not Set' | 'Conveyed to ED' | 'Left at Home (Own Consent)' | 'Left at Home (Against Advice)' | 'Referred to Other Service' | 'Deceased on Scene';
  dispositionDetails: {
    destination: string;
    receivingClinician: string;
    referralDetails: string;
  };
  handoverDetails: string;

  // Refusal of Care
  refusalOfCare: {
    refusedTreatment: boolean;
    refusedTransport: boolean;
    risksExplained: boolean;
    capacityDemonstrated: boolean;
    details: string;
  };

  safeguarding: {
    concerns: ('Child' | 'Adult' | 'Domestic Abuse' | 'Vulnerable Adult')[];
    details: string;
  };

  mentalCapacity: {
    assessment: ('Understands' | 'Retains' | 'Weighs' | 'Communicates')[];
    outcome: 'Has Capacity' | 'Lacks Capacity' | 'Fluctuating' | 'Not Assessed';
    details: string;
  };
  
  welfareLog: WelfareLogEntry[];
  
  attachments: Attachment[];

  patientSignatureUrl?: string;
  clinicianSignatureUrl?: string;
  signaturesNeedSync?: boolean;

  // Crew & Timestamps
  crewMembers: { uid: string; name: string; }[];
  createdAt: Timestamp;
  createdBy: { uid: string; name: string; };
  reviewedBy?: { uid: string; name: string; date: Timestamp; };
  reviewNotes?: string;
  auditLog: AuditEntry[];
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

export interface WelfareLogEntry {
  id: string;
  time: string;
  observation: string;
}


export interface MedicationAdministered {
    id: string; // for key prop
    time: string;
    medication: string;
    dose: string;
    route: 'PO' | 'IV' | 'IM' | 'SC' | 'SL' | 'PR' | 'Nebulised' | 'Other';
    authorisedBy?: { uid: string; name: string; };
}

export interface Intervention {
    id: string; // for key prop
    time: string;
    intervention: string;
    details: string;
}

export interface Injury {
    id: string;
    view: 'anterior' | 'posterior';
    drawingDataUrl: string; // base64 data URL of the canvas drawing
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
  start: Timestamp;
  end: Timestamp;
  assignedStaff: { uid: string; name: string; }[];
  assignedStaffUids: string[]; // For efficient querying
  roleRequired: string;
  notes?: string;
  isUnavailability?: boolean;
  unavailabilityReason?: string;
}

export interface Notification {
  id?: string;
  userId: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Announcement {
    id?: string;
    message: string;
    sentBy: { uid: string; name: string; };
    createdAt: Timestamp;
}

export interface Vehicle {
  id?: string;
  name: string; // e.g., 'Ambulance 1', 'RRV 3'
  registration: string;
  type: 'Ambulance' | 'RRV' | 'Car' | 'Buggy';
  status: 'In Service' | 'Maintenance Required' | 'Out of Service';
  lastCheck?: {
    date: Timestamp;
    user: { uid: string; name:string; };
    status: 'Pass' | 'Issues Found';
  };
  createdAt: Timestamp;
}

export interface VehicleCheck {
    id?: string;
    vehicleId: string;
    vehicleName: string;
    date: Timestamp;
    user: { uid: string; name: string; };
    mileage: number;
    fuelLevel: 'Full' | '3/4' | '1/2' | '1/4' | 'Empty';
    checklist: { [key: string]: 'Pass' | 'Fail' | 'N/A' };
    notes: string;
    overallStatus: 'Pass' | 'Issues Found';
}

export interface CPDEntry {
  id?: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: 'Formal Learning' | 'Work-based Learning' | 'Self-directed Learning' | 'Other';
  hours: number;
  learnings: string;
  reflection: string;
  attachmentUrl?: string;
  attachmentFileName?: string;
  createdAt: Timestamp;
}

export interface MajorIncident {
    id?: string;
    name: string;
    location: string;
    status: 'Active' | 'Stood Down';
    declaredAt: Timestamp;
    declaredBy: { uid: string; name: string; };
    stoodDownAt?: Timestamp;
    initialDetails: string;
}

export interface METHANEreport {
    id?: string;
    incidentId: string;
    submittedAt: Timestamp;
    submittedBy: { uid: string; name: string; };
    majorIncident: 'Yes' | 'No';
    exactLocation: string;
    typeOfIncident: string;
    hazards: string;
    access: string;
    numberOfCasualties: string;
    emergencyServices: string;
}

export interface StaffCheckin {
    id?: string; // Here, id will be the user's UID
    incidentId: string;
    userId: string;
    userName: string;
    userRole: User['role'];
    status: 'Available - On Site' | 'Available - En Route' | 'Unavailable';
    timestamp: Timestamp;
}

export interface Kit {
  id?: string;
  name: string; // e.g., 'Response Bag 1'
  type: 'Response Bag' | 'Trauma Bag' | 'Drug Kit' | 'O2 Bag';
  status: 'In Service' | 'Needs Restocking' | 'Out of Service' | 'With Crew';
  assignedTo?: { uid: string; name: string; };
  lastCheck?: {
    date: Timestamp;
    user: { uid: string; name:string; };
    status: 'Pass' | 'Issues Found';
  };
  createdAt: Timestamp;
  qrCodeValue?: string; // This will be the unique ID, formatted like 'aegis-kit-qr:KIT_ID'
}

export const KIT_CHECKLIST_ITEMS = {
    'Airway': ['OPAs', 'NPAs', 'i-gel', 'Catheter Mount'],
    'Breathing': ['BVM', 'Oxygen Mask', 'Nebuliser Kit', 'Chest Seal'],
    'Circulation': ['Dressings', 'Tourniquet', 'Bandages', 'IV Cannula'],
    'Diagnostics': ['Stethoscope', 'Pulse Oximeter', 'BP Cuff', 'Thermometer'],
    'Drugs': ['Aspirin', 'GTN Spray', 'Salbutamol', 'Adrenaline 1:1000'],
};


export interface KitCheck {
    id?: string;
    kitId: string;
    kitName: string;
    date: Timestamp;
    user: { uid: string; name: string; };
    type: 'Sign Out' | 'Sign In';
    checklist: { [key: string]: 'Pass' | 'Fail' | 'N/A' };
    itemsUsed?: { itemName: string, quantity: number }[];
    notes: string;
    overallStatus: 'Pass' | 'Issues Found';
}

export interface ControlledDrugLedgerEntry {
    id?: string;
    drugName: 'Morphine Sulphate 10mg/1ml' | 'Diazepam 10mg/2ml' | 'Midazolam 10mg/2ml' | 'Ketamine 100mg/2ml';
    batchNumber: string;
    expiryDate: string; // YYYY-MM-DD
    timestamp: Timestamp;
    type: 'Received' | 'Moved' | 'Administered' | 'Wasted' | 'Balance Check';
    
    // For movement/receiving
    fromLocation?: string; // 'Pharmacy', 'Safe', 'Drug Kit 1'
    toLocation?: string; // 'Safe', 'Drug Kit 1', 'Wasted'
    quantity?: number; // Number of ampoules/vials

    // For administration
    patientId?: string;
    patientName?: string;
    doseAdministered?: string; // e.g., '5mg'
    
    // For wastage
    wastedAmount?: string; // e.g., '5mg / 0.5ml'

    // For balance check
    balanceChecked?: number; // The new balance after the transaction
    
    // Audit
    user1: { uid: string; name: string; }; // Person performing action
    user2?: { uid: string; name: string; }; // Witness
    notes?: string;
}

export interface Kudo {
  id?: string;
  to: { uid: string; name: string; };
  from: { uid: string; name: string; };
  message: string;
  createdAt: Timestamp;
}

export interface AnonymousFeedback {
  id?: string;
  message: string;
  category: 'Concern' | 'Suggestion' | 'Positive';
  createdAt: Timestamp;
}

export interface AiAuditResult {
    id?: string; // Will be the same as eprfId
    eprfId: string;
    patientId: string;
    eventName: string;
    incidentDate: string;
    auditedAt: Timestamp;
    auditedBy: { uid: string; name: string; };
    
    completenessScore: number;
    guidelineAdherenceScore: number;
    documentationScore: number;
    overallScore: number;

    summary: string;
    strengths: string[];
    areasForImprovement: string[];
    keyLearningPoints: string[];
}