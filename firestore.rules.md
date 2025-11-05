# Aegis Hub Firestore Security Rules

This document outlines the recommended security rules for the Firestore database to ensure data integrity and security based on user roles. These rules should be deployed to your Firebase project.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Helper function to get a user's data safely
    function getUserData(userId) {
      return get(/databases/$(database)/documents/users/$(userId)).data;
    }

    // Helper function to check if a given user is a Manager or Admin
    function isManagerOrAdmin(uid) {
      let userData = getUserData(uid);
      return userData != null && 'role' in userData && userData.role in ['Manager', 'Admin'];
    }

    // Helper function to check for senior clinical roles for a given user
    function isSeniorClinician(uid) {
      let userData = getUserData(uid);
      return userData != null && 'role' in userData && userData.role in ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    }

    // Users Collection
    match /users/{userId} {
      allow read: if request.auth.uid == userId || isManagerOrAdmin(request.auth.uid);
      allow create: if request.auth.uid == userId;
      allow delete: if isManagerOrAdmin(request.auth.uid);
      
      // A manager or admin can update any user's profile.
      // A user can update their own profile, but they cannot change their 'role'.
      allow update: if isManagerOrAdmin(request.auth.uid) || (request.auth.uid == userId && request.resource.data.role == resource.data.role);
    }

    // Patients Collection
    // - Authenticated users can create patients.
    // - Authenticated users (staff) can read all patient data.
    // - Only managers/admins can update/delete patient records.
    match /patients/{patientId} {
      allow read, create: if request.auth != null;
      allow update, delete: if isManagerOrAdmin(request.auth.uid);
    }

    // ePRFs Collection
    // - Staff can create ePRFs.
    // - Staff can only read their own ePRFs.
    // - Managers/Admins can read all ePRFs.
    // - Staff can only update their own ePRFs if they are in 'Draft' status.
    // - Managers can update any ePRF (e.g., for review).
    // - Writes are blocked if they contain restricted drugs and the user is not a senior clinician.
    match /eprfs/{eprfId} {
        allow read: if resource.data.createdBy.uid == request.auth.uid || isManagerOrAdmin(request.auth.uid);
        
        allow create, update: if (
            // Standard create/update permissions: User can create or update their own draft, or user is a manager.
            (request.auth.uid == request.resource.data.createdBy.uid && (resource == null || resource.data.status == 'Draft')) 
            || isManagerOrAdmin(request.auth.uid)
          ) && (
            // Restricted drug check: If the form contains restricted drugs, the user must have a senior clinician role.
            request.resource.data.get('containsRestrictedDrugs', false) == true ? isSeniorClinician(request.auth.uid) : true
          );

        allow delete: if resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft';
    }

    // Events, Documents Collections
    // - All authenticated users can read.
    // - Only Managers/Admins can create, update, or delete.
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow write: if isManagerOrAdmin(request.auth.uid);
    }
    
    match /documents/{docId} {
        allow read: if request.auth != null;
        allow write: if isManagerOrAdmin(request.auth.uid);
    }

    // Shifts Collection
    match /shifts/{shiftId} {
        allow read: if request.auth != null;
        // Managers can create any shift. Users can create their own unavailability.
        allow create: if isManagerOrAdmin(request.auth.uid) || (request.resource.data.isUnavailability == true && request.auth.uid in request.resource.data.assignedStaffUids);
        // Managers can update any shift. Users can update the 'bids' array to bid on shifts.
        allow update: if isManagerOrAdmin(request.auth.uid) || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['bids']));
        // Managers can delete shifts. Users can delete their own unavailability.
        allow delete: if isManagerOrAdmin(request.auth.uid) || (resource.data.isUnavailability == true && request.auth.uid in resource.data.assignedStaffUids);
    }
    
    // Vehicle & Vehicle Checks
    // - All authenticated users can read vehicle data and create checks.
    // - Managers can create/update/delete vehicles.
    // - Nobody can edit or delete a vehicle check once submitted.
    match /vehicles/{vehicleId} {
        allow read: if request.auth != null;
        allow write: if isManagerOrAdmin(request.auth.uid);
        
        match /checks/{checkId} {
            allow read, create: if request.auth != null;
            allow update, delete: if false;
        }
    }
    
    // Kits & Kit Checks
    // - All authenticated users can read kit data and create checks.
    // - Managers can create/update/delete kits.
    // - Nobody can edit or delete a kit check once submitted.
    match /kits/{kitId} {
        allow read: if request.auth != null;
        allow write: if isManagerOrAdmin(request.auth.uid);
        
        match /checks/{checkId} {
            allow read, create: if request.auth != null;
            allow update, delete: if false;
        }
    }
    
    // Announcements
    // - All authenticated users can read.
    // - Only Managers/Admins can create.
    match /announcements/{announcementId} {
        allow read: if request.auth != null;
        allow create: if isManagerOrAdmin(request.auth.uid);
        allow update, delete: if false; // Announcements are immutable
    }

    // Notifications
    // - Users can read and update their own notifications (e.g., mark as read).
    // - Notifications are created by the system (any authenticated user acting on its behalf).
    // - Users cannot delete notifications.
    match /notifications/{notificationId} {
        allow read, update: if request.auth.uid == resource.data.userId;
        allow create: if request.auth != null;
        allow delete: if false;
    }

    // CPD Collection
    // - Users can create, read, update, and delete their own CPD entries.
    // - Users cannot access other users' entries.
    match /cpd/{cpdId} {
      allow read, update, delete: if request.auth.uid == resource.data.userId;
      allow create: if request.auth.uid == request.resource.data.userId;
    }

    // Major Incidents
    // - Managers can create/update incidents (e.g., stand down).
    // - All authenticated users can read incident details.
    match /majorIncidents/{incidentId} {
      allow read: if request.auth != null;
      allow create, update: if isManagerOrAdmin(request.auth.uid);

      // METHANE Reports
      // - Any authenticated user can create a report for an incident.
      // - All authenticated users can read reports.
      match /methaneReports/{reportId} {
        allow read: if request.auth != null;
        allow create: if request.auth.uid == request.resource.data.submittedBy.uid;
        allow update, delete: if false; // Reports are immutable
      }

      // Staff Check-ins
      // - A user can create/update their own check-in status (doc id is user.uid).
      // - All authenticated users can read check-in statuses.
      match /checkins/{userId} {
        allow read: if request.auth != null;
        allow write: if request.auth.uid == userId; // create, update
      }
    }

    // Controlled Drug Ledger
    // - Only senior clinicians can read or create entries.
    // - Ledger entries are immutable to preserve the audit trail.
    match /controlledDrugLedger/{entryId} {
      allow read, create: if isSeniorClinician(request.auth.uid);
      allow update, delete: if false;
    }

    // Kudos Collection
    // - All authenticated users can read.
    // - Users can only create kudos from themselves.
    // - Immutable once created.
    match /kudos/{kudoId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.from.uid;
      allow update, delete: if false;
    }

    // Anonymous Feedback
    // - Any authenticated user can create feedback.
    // - Only managers/admins can read feedback.
    // - Immutable once created.
    match /anonymousFeedback/{feedbackId} {
      allow read: if isManagerOrAdmin(request.auth.uid);
      allow create: if request.auth != null;
      allow update, delete: if false;
    }

    // AI Audit Results
    // - Only managers/admins can read and create audit results.
    // - Immutable once created.
    match /audits/{auditId} {
      allow read, create: if isManagerOrAdmin(request.auth.uid);
      allow update, delete: if false;
    }
  }
}
```