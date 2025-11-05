# Aegis Hub Firestore Security Rules

This document outlines the recommended security rules for the Firestore database to ensure data integrity and security based on user roles. These rules should be deployed to your Firebase project.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Helper function to check if user is a Manager or Admin
    function isManager() {
      return getUserRole() in ['Manager', 'Admin'];
    }

    // Helper function to check for senior clinical roles
    function isSeniorClinician() {
      let role = getUserRole();
      return role in ['FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Manager', 'Admin'];
    }
    
    // Helper function to get the user's role from the users collection
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    // Users Collection
    // - Users can read their own profile.
    // - Managers/Admins can read any user profile.
    // - Users can update their own profile, but cannot change their own role.
    // - Managers/Admins can update any user profile, including roles.
    match /users/{userId} {
      allow read: if request.auth.uid == userId || isManager();
      allow create: if request.auth.uid == userId;
      allow update: if (request.auth.uid == userId && !("role" in request.resource.data))
                      || isManager();
    }

    // Patients Collection
    // - Authenticated users can create patients.
    // - Authenticated users (staff) can read all patient data.
    // - Only managers should be able to update/delete patient records (TBD).
    match /patients/{patientId} {
      allow read, create: if request.auth != null;
      // allow update, delete: if isManager(); // Future enhancement
    }

    // ePRFs Collection
    // - Staff can create ePRFs.
    // - Staff can read/update their own draft ePRFs.
    // - Once status is not 'Draft', the creator cannot edit it.
    // - Managers can read all ePRFs.
    // - Managers can update an ePRF to set the review status.
    match /eprfs/{eprfId} {
        allow read: if request.auth != null;
        allow create: if request.auth.uid == request.resource.data.createdBy.uid;
        allow update: if (resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft')
                        || (isManager() && ("status" in request.resource.data || "reviewNotes" in request.resource.data));
        allow delete: if resource.data.createdBy.uid == request.auth.uid && resource.data.status == 'Draft';
    }

    // Events, Documents, Shifts Collections
    // - All authenticated users can read.
    // - Only Managers/Admins can create, update, or delete.
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow write: if isManager();
    }
    
    match /documents/{docId} {
        allow read: if request.auth != null;
        allow write: if isManager(); // Should be create/update/delete
    }

    match /shifts/{shiftId} {
        allow read: if request.auth != null;
        allow write: if isManager() || request.resource.data.isUnavailability == true; // allow users to add unavailability
    }
    
    // Vehicle & Vehicle Checks
    // - All authenticated users can read vehicle data and create checks.
    // - Managers can create/update/delete vehicles.
    // - Nobody can edit or delete a vehicle check once submitted.
    match /vehicles/{vehicleId} {
        allow read: if request.auth != null;
        allow write: if isManager(); // create, update, delete for vehicle doc
        
        match /checks/{checkId} {
            allow read, create: if request.auth != null;
            // No update/delete to preserve audit trail
        }
    }
    
    // Kits & Kit Checks
    // - All authenticated users can read kit data and create checks.
    // - Managers can create/update/delete kits.
    // - Nobody can edit or delete a kit check once submitted.
    match /kits/{kitId} {
        allow read: if request.auth != null;
        allow write: if isManager();
        
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
        allow create: if isManager();
        allow update, delete: if false; // Announcements are immutable
    }

    // Notifications
    // - Users can read and update their own notifications (e.g., mark as read).
    // - Users cannot create or delete their own notifications (system responsibility).
    match /notifications/{notificationId} {
        allow read, update: if request.auth.uid == resource.data.userId;
        allow create, delete: if false;
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
      allow create, update: if isManager();

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
      allow read, create: if isSeniorClinician();
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
      allow read: if isManager();
      allow create: if request.auth != null;
      allow update, delete: if false;
    }

    // AI Audit Results
    // - Only managers/admins can read and create audit results.
    // - Immutable once created.
    match /audits/{auditId} {
      allow read, create: if isManager();
      allow update, delete: if false;
    }
  }
}
```