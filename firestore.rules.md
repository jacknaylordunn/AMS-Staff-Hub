rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    function isManagerOrAdmin(uid) {
      return exists(/databases/$(database)/documents/users/$(uid)) &&
             getUserData(uid).role in ['Manager', 'Admin'];
    }

    function isSeniorClinician(uid) {
      return isAuthenticated() && exists(/databases/$(database)/documents/users/$(uid)) && 
             getUserData(uid).role in ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    }

    match /users/{userId} {
      allow get: if isAuthenticated() && (request.auth.uid == userId || isManagerOrAdmin(request.auth.uid));
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow update: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (request.auth.uid == userId && request.resource.data.role == resource.data.role));
    }

    match /patients/{patientId} {
      allow get, create: if isAuthenticated();
      allow list: if isAuthenticated();
      allow update, delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

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

    match /counters/{counterId} {
      allow read, write: if isAuthenticated();
    }

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

    match /shifts/{shiftId} {
        allow get: if isAuthenticated();
        allow list: if isAuthenticated(); 
        allow create: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (request.resource.data.isUnavailability == true && request.auth.uid in request.resource.data.allAssignedStaffUids));
        allow update: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        allow delete: if isAuthenticated() && (isManagerOrAdmin(request.auth.uid) || (resource.data.isUnavailability == true && request.auth.uid in resource.data.allAssignedStaffUids));
    }
    
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
    
    match /announcements/{announcementId} {
        allow read: if isAuthenticated();
        allow list: if isAuthenticated();
        allow create: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
        allow update: if false;
        allow delete: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
    }

    match /notifications/{notificationId} {
        allow read, update: if isAuthenticated() && request.auth.uid == resource.data.userId;
        allow list: if isAuthenticated() && request.query.where.userId == request.auth.uid;
        allow create: if false;
        allow delete: if false;
    }

    match /cpd/{cpdId} {
      allow read, update, delete: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow list: if isAuthenticated() && request.query.where.userId == request.auth.uid;
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
    }

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

    match /controlledDrugLedger/{entryId} {
      allow read, create: if isAuthenticated() && isSeniorClinician(request.auth.uid);
      allow list: if isAuthenticated() && isSeniorClinician(request.auth.uid);
      allow update, delete: if false;
    }

    match /kudos/{kudoId} {
      allow read: if isAuthenticated();
      allow list: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.from.uid;
      allow update, delete: if false;
    }

    match /anonymousFeedback/{feedbackId} {
      allow read: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    match /audits/{auditId} {
      allow read, create: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow list: if isAuthenticated() && isManagerOrAdmin(request.auth.uid);
      allow update, delete: if false;
    }
  }
}