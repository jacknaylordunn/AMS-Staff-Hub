rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    # Helper function to check for authentication
    function isAuthenticated() {
      return request.auth != null;
    }

    # Helper function to get a user's data safely
    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    # Helper function to check if a given user is a Manager or Admin
    function isManagerOrAdmin(uid) {
      return exists(/databases/$(database)/documents/users/$(uid)) &&
             getUserData(uid).role in ['Manager', 'Admin'];
    }

    # Helper function to check for senior clinical roles for a given user
    function isSeniorClinician(uid) {
      return isAuthenticated() && exists(/databases/$(database)/documents/users/$(uid)) && 
             getUserData(uid).role in ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    }

    # Users Collection
    match /users/{userId} {
      allow get: if isAuthenticated() && (request.auth.uid == userId || isManagerOrAdmin(request.auth.uid));
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (request.auth.uid == userId && request.resource.data.role == resource.data.role));
    }

    # Patients Collection
    match /patients/{patientId} {
      allow get, create: if isAuthenticated();
      allow list: if isAuthenticated();
      allow update, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    # ePRFs Collection
    match /eprfs/{eprfId} {
        allow get: if isAuthenticated() && (resource.data.createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid));
        allow list: if isAuthenticated(); 
        allow create, update: if isAuthenticated() && (
            (
                (request.auth.uid == request.resource.data.createdBy.uid && (resource == null || resource.data.status == 'Draft')) 
                || isManagerOrAdmin(request.auth.uid)
            ) && (
                request.resource.data.get('containsRestrictedDrugs', false) == true ? isSeniorClinician(request.auth.uid) : true
            )
        );
        allow delete: if isAuthenticated() && resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft';
    }

    # Counters
    match /counters/{counterId} {
      allow read, write: if isAuthenticated();
    }

    # Events, Documents Collections
    match /events/{eventId} {
      allow get: if isAuthenticated();
      allow list: if isAuthenticated();
      allow write: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }
    
    match /documents/{docId} {
        allow get: if isAuthenticated();
        allow list: if isAuthenticated();
        allow write: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    # Shifts Collection
    match /shifts/{shiftId} {
        allow get: if isAuthenticated();
        allow list: if isAuthenticated(); 
        allow create: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (request.resource.data.isUnavailability == true && request.auth.uid in request.resource.data.allAssignedStaffUids));
        allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || 
                       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['slots'])));
        allow delete: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (resource.data.isUnavailability == true && request.auth.uid in resource.data.allAssignedStaffUids));
    }
    
    # Vehicle & Vehicle Checks
    match /vehicles/{vehicleId} {
        allow get: if isAuthenticated();
        allow list: if isAuthenticated();
        allow create, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || 
                       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastCheck', 'status'])));
        
        match /checks/{checkId} {
            allow read, create: if isAuthenticated();
            allow update, delete: if false; 
        }
    }
    
    # Kits & Kit Checks
    match /kits/{kitId} {
        allow get: if isAuthenticated();
        allow list: if isAuthenticated();
        allow create, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) ||
                       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastCheck', 'status', 'assignedTo', 'trackedItems'])));

        match /checks/{checkId} {
            allow read, create: if isAuthenticated();
            allow update, delete: if false;
        }
    }
    
    # Announcements
    match /announcements/{announcementId} {
        allow read: if isAuthenticated();
        allow list: if isAuthenticated();
        allow create: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        allow update: if false;
        allow delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    # Notifications
    match /notifications/{notificationId} {
        allow read, update: if isAuthenticated() && request.auth.uid == resource.data.userId;
        # FIX: Corrected rule syntax. Users can only list their own notifications.
        allow list: if isAuthenticated() && request.query.where.userId == request.auth.uid;
        allow create: if false;
        allow delete: if false;
    }

    # CPD Collection
    match /cpd/{cpdId} {
      allow read, update, delete: if isAuthenticated() && request.auth.uid == resource.data.userId;
      # FIX: Corrected rule syntax. Users can only list their own CPD.
      allow list: if isAuthenticated() && request.query.where.userId == request.auth.uid;
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
    }

    # Major Incidents
    match /majorIncidents/{incidentId} {
      allow get: if isAuthenticated();
      allow list: if isAuthenticated();
      allow create, update: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);

      match /methaneReports/{reportId} {
        allow read, create: if isAuthenticated();
        allow list: if isAuthenticated();
        allow update, delete: if false;
      }

      match /checkins/{userId} {
        allow read: if isAuthenticated();
        allow list: if isAuthenticated();
        allow write: if isAuthenticated() && request.auth.uid == userId;
      }
    }

    # Controlled Drug Ledger
    match /controlledDrugLedger/{entryId} {
      allow read, create: if isAuthenticated() && isSeniorClinician(request.auth.uid);
      allow list: if isAuthenticated() && isSeniorClinician(request.auth.uid);
      allow update, delete: if false;
    }

    # Kudos Collection
    match /kudos/{kudoId} {
      allow read: if isAuthenticated();
      allow list: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.from.uid;
      allow update, delete: if false;
    }

    # Anonymous Feedback
    match /anonymousFeedback/{feedbackId} {
      allow read: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    # AI Audit Results
    match /audits/{auditId} {
      allow read, create: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow update, delete: if false;
    }
  }
}