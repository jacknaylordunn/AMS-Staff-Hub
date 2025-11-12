rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- HELPER FUNCTIONS ---
    function isAuthenticated() {
      return request.auth != null;
    }
    function isUser(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }
    function getRole(userId) {
      return getUserData(userId).role;
    }
    function isManager() {
      return isAuthenticated() && getRole(request.auth.uid) in ['Manager', 'Admin'];
    }
    function isAdmin() {
      return isAuthenticated() && getRole(request.auth.uid) == 'Admin';
    }
    function isSeniorClinician(uid) {
      return isAuthenticated() && getRole(uid) in ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    }
    
    // --- VALIDATION FUNCTIONS ---
    function isValidString(str, min, max) {
      return str is string && str.size() >= min && str.size() <= max;
    }
    
    // --- COLLECTIONS ---

    match /users/{userId} {
      allow get: if isUser(userId) || isManager();
      allow list: if isManager();
      allow create: if isUser(userId)
                    && isValidString(request.resource.data.firstName, 1, 50)
                    && isValidString(request.resource.data.lastName, 1, 50)
                    && request.resource.data.email == request.auth.token.email
                    && request.resource.data.role == 'Pending'
                    && request.resource.data.createdAt == request.time;
      allow update: if (isUser(userId) && request.resource.data.role == resource.data.role && request.resource.data.email == resource.data.email) || isManager();
      allow delete: if isAdmin(); // only admins can delete users (via cloud function)
    }

    match /patients/{patientId} {
      allow create: if isAuthenticated();
      allow update, delete: if isManager();
      // Users can only read patients they are authorized for. Authorization is granted via a cloud function when an ePRF is created.
      allow get: if isManager() || (isAuthenticated() && request.auth.uid in resource.data.authorizedClinicianUids);
      allow list: if isManager();
    }

    match /eprfs/{eprfId} {
      function isOwner() {
        return resource.data.createdBy.uid == request.auth.uid;
      }
      function isCrewMember() {
        // This rule requires a 'crewMemberUids' array of strings on the document.
        // This field is managed by the onEprfWrite cloud function.
        return request.auth.uid in resource.data.crewMemberUids;
      }
      function isDraft() {
        return resource.data.status == 'Draft';
      }

      // A crew member or a manager can get an individual document.
      allow get: if isAuthenticated() && (isCrewMember() || isManager());
      
      // Any authenticated user can perform queries. The query will only succeed if every
      // document in the result set passes the 'get' rule. This forces client-side
      // queries to be properly filtered (e.g., using 'array-contains' on crewMemberUids).
      allow list: if isAuthenticated();
      
      allow create: if isAuthenticated()
                    && request.resource.data.createdBy.uid == request.auth.uid
                    && request.resource.data.status == 'Draft';
      
      allow update: if isAuthenticated() && (
                      (isOwner() && isDraft()) || // Owner can edit their own draft
                      isManager() // Manager can edit anything (e.g., to return for correction)
                    );
      allow delete: if isAuthenticated() && isOwner() && isDraft();
    }
    
    match /shifts/{shiftId} {
        allow read: if isAuthenticated();
        // Allow create for managers, or for any user if it's an unavailability they are part of
        allow create: if isAuthenticated() && (isManager() || (request.resource.data.isUnavailability == true && request.auth.uid in request.resource.data.allAssignedStaffUids));
        // Allow update for managers, or for user updating their own unavailability
        allow update: if isAuthenticated() && (isManager() || (resource.data.isUnavailability == true && request.resource.data.isUnavailability == true && request.auth.uid in resource.data.allAssignedStaffUids));
        // Allow delete for managers, or for owner of unavailability
        allow delete: if isAuthenticated() && (isManager() || (resource.data.isUnavailability == true && request.auth.uid in resource.data.allAssignedStaffUids));
    }
    
    match /timeClockEntries/{entryId} {
        allow read: if isUser(resource.data.userId) || isManager();
        allow list: if isManager(); // Manager can list all
        allow create: if isUser(request.resource.data.userId)
                      && request.resource.data.status == 'Clocked In'
                      && !('clockOutTime' in request.resource.data);
        allow update: if isUser(resource.data.userId)
                      && request.resource.data.status == 'Clocked Out'
                      && request.resource.data.clockOutTime > resource.data.clockInTime;
    }
    
    match /userAnalytics/{userId} {
        allow read: if isManager();
        allow write: if false; // Only cloud functions can write
    }

    match /controlledDrugLedger/{entryId} {
      allow read, create: if isSeniorClinician(request.auth.uid);
      allow list: if isSeniorClinician(request.auth.uid);
      allow update, delete: if false;
    }

    match /counters/{counterId} {
      allow read, write: if false; // Should only be written by backend functions.
    }
    
    match /documents/{docId} {
        allow read: if isAuthenticated();
        allow write: if isManager();
    }
    
    match /vehicles/{vehicleId} {
        allow read: if isAuthenticated();
        allow write: if isManager();
        match /checks/{checkId} {
            allow read, create: if isAuthenticated();
            allow write: if false; 
        }
    }
    
    match /kits/{kitId} {
        allow read: if isAuthenticated();
        allow write: if isManager();
        match /checks/{checkId} {
            allow read, create: if isAuthenticated();
            allow write: if false;
        }
    }
    
    match /announcements/{announcementId} {
        allow read: if isAuthenticated();
        allow create: if isManager(); // through cloud function
        allow delete: if isManager();
    }

    match /notifications/{notificationId} {
        allow read, update: if isUser(resource.data.userId);
        allow create, delete: if false; // Backend only
    }

    match /cpd/{cpdId} {
      allow read, write: if isUser(resource.data.userId);
      allow create: if isUser(request.resource.data.userId);
    }

    match /majorIncidents/{incidentId} {
      allow read: if isAuthenticated();
      allow write: if isManager();
      match /methaneReports/{reportId} {
        allow read, create: if isAuthenticated();
        allow write: if false;
      }
      match /checkins/{userId} {
        allow read: if isAuthenticated();
        allow write: if isUser(userId);
      }
    }

    match /kudos/{kudoId} {
      allow read: if isAuthenticated();
      allow create: if isUser(request.resource.data.from.uid);
      allow write: if false;
    }

    match /anonymousFeedback/{feedbackId} {
      allow read: if isManager();
      allow create: if isAuthenticated();
      allow write: if false;
    }

    match /audits/{auditId} {
      allow read: if isManager();
      allow create, write: if false; // Backend only
    }
  }
}