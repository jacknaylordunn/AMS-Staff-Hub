import { useState, useEffect } from 'react';
import type { Patient } from '../types';
import { searchPatients } from '../services/patientService';

export const usePatientSearch = () => {
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (patientSearch.length <= 2) {
            setSearchResults([]);
            setSearchLoading(false); // Ensure loading is false
            return;
        }

        const handler = setTimeout(async () => {
            setSearchLoading(true); // Set loading right before the async call
            try {
                const results = await searchPatients(patientSearch);
                setSearchResults(results);
            } catch (error) {
                console.error("Error searching patients:", error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 500);

        // Cleanup function: clears the timeout if the component unmounts or if the dependency changes before the timeout fires.
        return () => {
            clearTimeout(handler);
        };
    }, [patientSearch]);

    return {
        patientSearch,
        setPatientSearch,
        searchResults,
        searchLoading,
    };
};
