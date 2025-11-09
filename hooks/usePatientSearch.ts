import { useState, useEffect } from 'react';
import type { Patient } from '../types';
import { searchPatients } from '../services/patientService';

export const usePatientSearch = () => {
    const [patientSearch, setPatientSearch] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (patientSearch.length > 2) {
                setSearchLoading(true);
                const results = await searchPatients(patientSearch);
                setSearchResults(results);
                setSearchLoading(false);
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [patientSearch]);

    return {
        patientSearch,
        setPatientSearch,
        searchResults,
        searchLoading,
    };
};
