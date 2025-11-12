

// Replaced modular SDK type imports with compat equivalents.
// The 'firestore' named export does not exist on 'firebase/compat/app'. Changed to default import 'firebase' and used 'firebase.firestore' to access types like Timestamp and GeoPoint.
import firebase from 'firebase/compat/app';

export interface ComplianceDocument {
  id: string;
  name: string;
  url: string;
  fileName: string;
  expiryDate?: string; // YYYY-MM-DD
  uploadedAt: firebase.firestore.Timestamp;
}

export interface User {
  uid: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role?: 'Pending' | 'First Aider' | 'FREC3' | 'FREC4/ECA' | 'FREC5/EMT/AAP' | 'Paramedic' | 'Nurse' | 'Doctor' | 'Welfare' | 'Admin' | 'Manager';
  pendingRole?: User['role'];
  registrationNumber?: string;
  createdAt?: firebase.firestore.Timestamp;
  complianceDocuments?: ComplianceDocument[];
  fcmTokens?: string[];
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
    authorizedClinicianUids?: string[];
}

export interface AuditEntry {
  timestamp: firebase.firestore.Timestamp;
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

export type CommonIntervention = 'Wound Care' | 'Splinting' | 'Airway Management' | 'IV Cannulation' | 'Medication Administered' | 'CPR' | 'Defibrillation' | 'Patient Positioning' | 'C-Spine Immobilisation' | 'Other';

export interface EPRFForm {
  id?: string;
  status?: 'Draft' | 'Pending Review' | 'Reviewed';
  // Linking IDs
  patientId: string | null;
  shiftId: string | null;
  eventName: string | null;

  presentationType: 'Medical/Trauma' | 'Minor Injury' | 'Welfare/Intox';
  
  // Incident
  natureOfCall: 'Emergency' | 'Urgent' | 'Routine' | 'Standby';
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
  socialHistory?: string;
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
    pupils: {
        leftSize: string;
        leftResponse: 'Normal' | 'Sluggish' | 'Fixed';
        rightSize: string;
        rightResponse: 'Normal' | 'Sluggish' | 'Fixed';
    };
    bloodGlucoseLevel?: string;
    fastTest?: {
        face: 'Normal' | 'Abnormal';
        arms: 'Normal' | 'Abnormal';
        speech: 'Normal' | 'Abnormal';
    };
  };
  exposure: string;

  // Structured Assessment Findings
  airwayDetails: {
      status: 'Clear' | 'Partially Obstructed' | 'Obstructed';
      adjuncts: ('OPA' | 'NPA' | 'i-gel' | 'LMA')[];
  };
  breathingDetails: {
      effort: 'Normal' | 'Shallow' | 'Labored' | 'Gasping';
      sounds: ('Clear' | 'Wheeze' | 'Crackles' | 'Stridor' | 'Reduced/Absent')[];
      sides: ('Bilaterally' | 'Left' | 'Right')[];
  };
  circulationDetails: {
      pulseQuality: 'Strong' | 'Weak' | 'Thready' | 'Bounding' | 'Absent';
      skin: 'Normal' | 'Pale' | 'Cyanosed' | 'Flushed' | 'Clammy' | 'Jaundiced';
      capillaryRefillTime: string;
      heartSounds: string;
  };
  limbAssessment: {
      luPower: '0' | '1' | '2' | '3' | '4' | '5';
      luSensation: 'Normal' | 'Reduced' | 'Absent';
      llPower: '0' | '1' | '2' | '3' | '4' | '5';
      llSensation: 'Normal' | 'Reduced' | 'Absent';
      ruPower: '0' | '1' | '2' | '3' | '4' | '5';
      ruSensation: 'Normal' | 'Reduced' | 'Absent';
      rlPower: '0' | '1' | '2' | '3' | '4' | '5';
      rlSensation: 'Normal' | 'Reduced' | 'Absent';
  };

  
  // Vitals & Secondary Survey
  vitals: VitalSign[];
  secondarySurvey: string;
  injuries: Injury[];

  // Treatment & Disposition
  impressions: string[];
  medicationsAdministered: MedicationAdministered[];
  interventions: Intervention[];
  itemsUsed: string[];
  otherAgencies?: string[];
  disposition: 'Not Set' | 'Conveyed to ED' | 'Left at Home (Own Consent)' | 'Left at Home (Against Advice)' | 'Referred to Other Service' | 'Deceased on Scene';
  dispositionDetails: {
    destination: string;
    handoverTo: string;
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
  createdAt: firebase.firestore.Timestamp;
  createdBy: { uid: string; name: string; };
  reviewedBy?: { uid: string; name: string; date: firebase.firestore.Timestamp; };
  reviewNotes?: string;
  auditLog: AuditEntry[];
  containsRestrictedDrugs?: boolean;
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
    
    // For Controlled Drugs
    isControlledDrug?: boolean;
    batchNumber?: string;
    witness?: { uid: string; name: string; };
    amountWasted?: string; // e.g. "5mg / 0.5ml"
}

export interface Intervention {
    id: string; // for key prop
    time: string;
    intervention: CommonIntervention;
    details: string;
}

export interface Injury {
    id: string;
    view: 'anterior' | 'posterior';
    coords: { x: number; y: number };
    type: 'IV Access' | 'IO Access' | 'Wound' | 'Fracture' | 'Burn' | 'Other';
    description: string;
    details?: {
        ivSize?: '14g' | '16g' | '18g' | '20g' | '22g' | '24g';
        ivSuccess?: boolean;
        woundType?: 'Laceration' | 'Abrasion' | 'Puncture' | 'Avulsion';
        bleedingControlled?: boolean;
    };
    drawingDataUrl?: string;
}

export interface CompanyDocument {
  id: string;
  title: string;
  category: 'SOP' | 'Guideline' | 'Procedure';
  url: string;
  version: string;
}

export interface ShiftSlot {
  id: string;
  roleRequired: Exclude<User['role'], undefined | 'Pending' | 'Admin' | 'Manager'>;
  assignedStaff: { uid: string; name: string; } | null;
  bids: { uid: string; name: string; timestamp: firebase.firestore.Timestamp; }[];
}

export interface Shift {
  id?: string;
  eventName: string;
  location: string;
  start: firebase.firestore.Timestamp;
  end: firebase.firestore.Timestamp;
  status: 'Open' | 'Partially Assigned' | 'Fully Assigned' | 'Completed';
  slots: ShiftSlot[];
  allAssignedStaffUids: string[]; // For efficient querying. Aggregates all assigned UIDs from slots.
  notes?: string;
  isUnavailability?: boolean;
  unavailabilityReason?: string;
  assignedVehicleIds?: string[];
  assignedVehicleNames?: string[];
  assignedKitIds?: string[];
  assignedKitNames?: string[];
}

export interface TimeClockEntry {
  id?: string;
  userId: string;
  userName: string;
  shiftId: string;
  shiftName: string;
  clockInTime: firebase.firestore.Timestamp;
  clockOutTime?: firebase.firestore.Timestamp;
  clockInLocation?: firebase.firestore.GeoPoint;
  clockOutLocation?: firebase.firestore.GeoPoint;
  durationHours?: number;
  status: 'Clocked In' | 'Clocked Out';
}

export interface Notification {
  id?: string;
  userId: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: firebase.firestore.Timestamp;
}

export interface Announcement {
    id?: string;
    message: string;
    sentBy: { uid: string; name: string; };
    createdAt: firebase.firestore.Timestamp;
}

export interface Vehicle {
  id?: string;
  name: string; // e.g., 'Ambulance 1', 'RRV 3'
  registration: string;
  type: 'Ambulance' | 'RRV' | 'Car' | 'Buggy';
  status: 'In Service' | 'Maintenance Required' | 'Out of Service';
  lastCheck?: {
    date: firebase.firestore.Timestamp;
    user: { uid: string; name:string; };
    status: 'Pass' | 'Issues Found';
  };
  createdAt: firebase.firestore.Timestamp;
  qrCodeValue?: string;
}

export const VEHICLE_CHECKLIST_ITEMS = {
    'Exterior': ['Bodywork & Livery', 'Windscreen & Wipers', 'Mirrors'],
    'Tyres & Wheels': ['All Tyre Pressures', 'All Tyre Condition', 'Wheel Nuts Secure'],
    'Engine Bay': ['Engine Oil Level', 'Coolant Level', 'Brake Fluid Level', 'Windscreen Washer Fluid'],
    'Interior & Cab': ['Dash Warnings', 'Fuel Level', 'Cab Cleanliness', 'Seatbelts', 'Fire Extinguisher'],
    'Emergency Systems': ['Blue Lights', 'Headlights / Taillights', 'Indicators', 'Brake Lights', 'Sirens & Horn'],
    'Patient Compartment - General': ['Compartment Cleanliness', 'Stretcher & Carry Chair', 'Sharps Bins'],
    'Patient Compartment - Clinical': ['Main Oxygen Cylinder Level', 'Portable Oxygen Cylinder Level', 'Defibrillator Check', 'Suction Unit Check', 'Entonox Cylinder Level'],
};


export interface VehicleCheck {
    id?: string;
    vehicleId: string;
    vehicleName: string;
    date: firebase.firestore.Timestamp;
    user: { uid: string; name: string; };
    mileage: number;
    fuelLevel: 'Full' | '3/4' | '1/2' | '1/4' | 'Empty';
    checklist: { [key: string]: { status: 'Pass' | 'Fail' | 'N/A'; note?: string } };
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
  createdAt: firebase.firestore.Timestamp;
}

export interface MajorIncident {
    id?: string;
    name: string;
    location: string;
    status: 'Active' | 'Stood Down';
    declaredAt: firebase.firestore.Timestamp;
    declaredBy: { uid: string; name: string; };
    stoodDownAt?: firebase.firestore.Timestamp;
    initialDetails: string;
}

export interface METHANEreport {
    id?: string;
    incidentId: string;
    submittedAt: firebase.firestore.Timestamp;
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
    timestamp: firebase.firestore.Timestamp;
}

export type KitChecklistItem = {
  name: string;
  category: string;
  trackable?: boolean; // To flag items like drugs that need expiry/batch tracking
};

export interface Kit {
  id?: string;
  name: string; // e.g., 'Response Bag 1'
  type: 'Response Bag' | 'Trauma Bag' | 'Drug Kit' | 'O2 Bag';
  status: 'In Service' | 'Needs Restocking' | 'Out of Service' | 'With Crew';
  assignedTo?: { uid: string; name: string; };
  lastCheck?: {
    date: firebase.firestore.Timestamp;
    user: { uid: string; name:string; };
    status: 'Pass' | 'Issues Found';
  };
  createdAt: firebase.firestore.Timestamp;
  qrCodeValue?: string; // This will be the unique ID, formatted like 'aegis-kit-qr:KIT_ID'
  trackedItems?: { itemName: string; expiryDate?: string; batchNumber?: string; }[];
  checklistItems?: KitChecklistItem[];
}

export const DEFAULT_KIT_CHECKLISTS: { [key in Kit['type']]: KitChecklistItem[] } = {
    'Response Bag': [
        {name: 'OPAs', category: 'Airway'}, 
        {name: 'NPAs', category: 'Airway'}, 
        {name: 'i-gel', category: 'Airway', trackable: true}, 
        {name: 'Catheter Mount', category: 'Airway'},
        {name: 'BVM', category: 'Breathing'}, 
        {name: 'Oxygen Mask', category: 'Breathing'}, 
        {name: 'Nebuliser Kit', category: 'Breathing'}, 
        {name: 'Chest Seal', category: 'Breathing', trackable: true},
        {name: 'Dressings', category: 'Circulation'}, 
        {name: 'Tourniquet', category: 'Circulation'}, 
        {name: 'Bandages', category: 'Circulation'}, 
        {name: 'IV Cannula', category: 'Circulation', trackable: true},
        {name: 'Stethoscope', category: 'Diagnostics'}, 
        {name: 'Pulse Oximeter', category: 'Diagnostics'}, 
        {name: 'BP Cuff', category: 'Diagnostics'}, 
        {name: 'Thermometer', category: 'Diagnostics'},
    ],
    'Drug Kit': [
        {name: 'Aspirin', category: 'Drugs', trackable: true}, 
        {name: 'GTN Spray', category: 'Drugs', trackable: true}, 
        {name: 'Salbutamol', category: 'Drugs', trackable: true}, 
        {name: 'Adrenaline 1:1000', category: 'Drugs', trackable: true},
        {name: 'IV Fluids', category: 'IV Admin', trackable: true},
        {name: 'Giving Set', category: 'IV Admin', trackable: true},
    ],
    'Trauma Bag': [
        {name: 'Haemostatic Dressing', category: 'Haemorrhage', trackable: true},
        {name: 'Tourniquet', category: 'Haemorrhage'},
        {name: 'Chest Seal', category: 'Breathing', trackable: true},
        {name: 'Pelvic Binder', category: 'Splinting'},
        {name: 'Fracture Straps', category: 'Splinting'},
    ],
    'O2 Bag': [
        {name: 'CD Oxygen Cylinder', category: 'Oxygen'},
        {name: 'BVM', category: 'Airway'},
        {name: 'Non-Rebreath Mask', category: 'Masks'},
    ],
};


export interface KitCheck {
    id?: string;
    kitId: string;
    kitName: string;
    date: firebase.firestore.Timestamp;
    user: { uid: string; name: string; };
    type: 'Sign Out' | 'Sign In';
    checkedItems: { itemName: string; status: 'Pass' | 'Fail' | 'N/A'; note?: string; expiryDate?: string; batchNumber?: string; }[];
    itemsUsed?: { itemName: string, quantity: number }[];
    notes: string;
    overallStatus: 'Pass' | 'Issues Found';
}

export interface ControlledDrugLedgerEntry {
    id?: string;
    drugName: 'Morphine Sulphate 10mg/1ml' | 'Diazepam 10mg/2ml' | 'Midazolam 10mg/2ml' | 'Ketamine 100mg/2ml';
    batchNumber: string;
    expiryDate: string; // YYYY-MM-DD
    timestamp: firebase.firestore.Timestamp;
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
  createdAt: firebase.firestore.Timestamp;
}

export interface AnonymousFeedback {
  id?: string;
  message: string;
  category: 'Concern' | 'Suggestion' | 'Positive';
  createdAt: firebase.firestore.Timestamp;
}

export interface AiAuditResult {
    id?: string; // Will be the same as eprfId
    eprfId: string;
    patientId: string;
    eventName: string | null;
    incidentDate: string;
    auditedAt: firebase.firestore.Timestamp;
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

export interface UserAnalytics {
  totalHours: number;
  shiftCount: number;
  monthlyHours: { [key: string]: number }; // "YYYY-MM": hours
  lastUpdated: firebase.firestore.Timestamp;
  userName: string;
}