# Aegis Hub Firestore Security Rules

This document outlines the recommended security rules for the Firestore database to ensure data integrity and security based on user roles. These should be deployed to your Firebase project.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Helper function to check for authentication
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to get a user's data safely
    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    // Helper function to check if a given user is a Manager or Admin
    function isManagerOrAdmin(uid) {
      return exists(/databases/$(database)/documents/users/$(uid)) &&
             getUserData(uid).role in ['Manager', 'Admin'];
    }

    // Helper function to check for senior clinical roles for a given user
    function isSeniorClinician(uid) {
      return isAuthenticated() && exists(/databases/$(database)/documents/users/$(uid)) && 
             getUserData(uid).role in ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    }

    // Users Collection
    match /users/{userId} {
      // A user can get their own document, and managers can get any user document.
      allow get: if isAuthenticated() && (request.auth.uid == userId || isManagerOrAdmin(request.auth.uid));

      // Only managers can list multiple user documents (e.g., for the Staff page).
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);

      // A user can create their own profile upon registration.
      allow create: if isAuthenticated() && request.auth.uid == userId;
      
      // Only managers can delete users.
      allow delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      
      // A manager or admin can update any user's profile.
      // A user can update their own profile, but they cannot change their 'role'.
      allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (request.auth.uid == userId && request.resource.data.role == resource.data.role));
    }

    // Patients Collection
    // - Authenticated users can create patients.
    // - Authenticated users (staff) can read all patient data.
    // - Only managers/admins can update/delete patient records.
    match /patients/{patientId} {
      allow read, create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    // ePRFs Collection
    // - Staff can create ePRFs.
    // - Staff can only read their own ePRFs.
    // - Managers/Admins can read all ePRFs.
    // - Staff can only update their own ePRFs if they are in 'Draft' status.
    // - Managers can update any ePRF (e.g., for review).
    // - Writes are blocked if they contain restricted drugs and the user is not a senior clinician.
    match /eprfs/{eprfId} {
        allow read: if isAuthenticated() && (resource.data.createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid));
        
        allow create, update: if isAuthenticated() && (
            (
                // Standard create/update permissions: User can create or update their own draft, or user is a manager.
                (request.auth.uid == request.resource.data.createdBy.uid && (resource == null || resource.data.status == 'Draft')) 
                || isManagerOrAdmin(request.auth.uid)
            ) && (
                // Restricted drug check: If the form contains restricted drugs, the user must have a senior clinician role.
                request.resource.data.get('containsRestrictedDrugs', false) == true ? isSeniorClinician(request.auth.uid) : true
            )
        );

        allow delete: if isAuthenticated() && resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft';
    }

    // Counters for atomic operations (e.g., incident numbers)
    // Any authenticated user can read/write to ensure they can get a number.
    match /counters/{counterId} {
      allow read, write: if isAuthenticated();
    }

    // Events, Documents Collections
    // - All authenticated users can read.
    // - Only Managers/Admins can create, update, or delete.
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }
    
    match /documents/{docId} {
        allow read: if isAuthenticated();
        allow write: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    // Shifts Collection
    match /shifts/{shiftId} {
        allow read: if isAuthenticated();
        // Managers can create shifts. Users can create their own unavailability.
        allow create: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (request.resource.data.isUnavailability == true && request.auth.uid in request.resource.data.allAssignedStaffUids));
        // Managers can update anything. Users can only update the 'slots' field (for bidding).
        allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || 
                       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['slots'])));
        // Managers can delete shifts. Users can delete their own unavailability.
        allow delete: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (resource.data.isUnavailability == true && request.auth.uid in resource.data.allAssignedStaffUids));
    }
    
    // Vehicle & Vehicle Checks
    match /vehicles/{vehicleId} {
        allow read: if isAuthenticated();
        allow create, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        // Managers can update everything. Any auth'd user can update only the status and lastCheck fields (for submitting checks).
        allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || 
                       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastCheck', 'status'])));
        
        match /checks/{checkId} {
            allow read, create: if isAuthenticated();
            allow update, delete: if false; // Checks are immutable
        }
    }
    
    // Kits & Kit Checks
    match /kits/{kitId} {
        allow read: if isAuthenticated();
        allow create, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        // Managers can update everything. Any auth'd user can update fields related to checks/assignments.
        allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) ||
                       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastCheck', 'status', 'assignedTo', 'trackedItems'])));

        match /checks/{checkId} {
            allow read, create: if isAuthenticated();
            allow update, delete: if false; // Checks are immutable
        }
    }
    
    // Announcements
    // - All authenticated users can read.
    // - Only Managers/Admins can create or delete.
    match /announcements/{announcementId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        allow update: if false; // Announcements are immutable
        allow delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    // Notifications
    // - Users can read and update their own notifications (e.g., mark as read).
    // - Notifications are now created only by secure Cloud Functions.
    // - Users cannot delete notifications.
    match /notifications/{notificationId} {
        allow read, update: if isAuthenticated() && request.auth.uid == resource.data.userId;
        allow create: if false; // All notifications created via Cloud Functions
        allow delete: if false;
    }

    // CPD Collection
    // - Users can create, read, update, and delete their own CPD entries.
    // - Users cannot access other users' entries.
    match /cpd/{cpdId} {
      allow read, update, delete: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
    }

    // Major Incidents
    // - Managers can create/update incidents (e.g., stand down).
    // - All authenticated users can read incident details.
    match /majorIncidents/{incidentId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);

      // METHANE Reports
      // - Any authenticated user can create a report for an incident.
      // - All authenticated users can read reports.
      match /methaneReports/{reportId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && request.auth.uid == request.resource.data.submittedBy.uid;
        allow update, delete: if false; // Reports are immutable
      }

      // Staff Check-ins
      // - A user can create/update their own check-in status (doc id is user.uid).
      // - All authenticated users can read check-in statuses.
      match /checkins/{userId} {
        allow read: if isAuthenticated();
        allow write: if isAuthenticated() && request.auth.uid == userId; // create, update
      }
    }

    // Controlled Drug Ledger
    // - Only senior clinicians can read or create entries.
    // - Ledger entries are immutable to preserve the audit trail.
    match /controlledDrugLedger/{entryId} {
      allow read, create: if isAuthenticated() && isSeniorClinician(request.auth.uid);
      allow update, delete: if false;
    }

    // Kudos Collection
    // - All authenticated users can read.
    // - Users can only create kudos from themselves.
    // - Immutable once created.
    match /kudos/{kudoId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.from.uid;
      allow update, delete: if false;
    }

    // Anonymous Feedback
    // - Any authenticated user can create feedback.
    // - Only managers/admins can read feedback.
    // - Immutable once created.
    match /anonymousFeedback/{feedbackId} {
      allow read: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    // AI Audit Results
    // - Only managers/admins can read and create audit results.
    // - Immutable once created.
    match /audits/{auditId} {
      allow read, create: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow update, delete: if false;
    }
  }
}