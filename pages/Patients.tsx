
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Patient } from '../types';
import { getPatients, addPatient } from '../services/firestoreService';
import { SpinnerIcon } from '../components/icons';
import PatientModal from '../components/PatientModal';
import { showToast } from '../components/Toast';

const Patients: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();
    
    useEffect(() => {
        fetchPatients();
    }, []);
    
    const fetchPatients = async () => {
        setLoading(true);
        const patientList = await getPatients(searchTerm);
        setPatients(patientList);
        setLoading(false);
    };
    
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPatients();
    }

    const handleSaveNewPatient = async (newPatient: Omit<Patient, 'id' | 'createdAt'>) => {
        try {
            await addPatient(newPatient);
            showToast('Patient created successfully.', 'success');
            setIsModalOpen(false);
            fetchPatients(); // Refresh the list
        } catch (error) {
            console.error(error);
            showToast('Failed to create patient.', 'error');
        }
    };

    return (
        <div>
            <PatientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveNewPatient} />

            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">Patient Records</h1>
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <form onSubmit={handleSearch} className="flex flex-grow gap-4">
                    <input
                        type="text"
                        placeholder="Search by name or DOB (YYYY-MM-DD)..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    />
                    <button type="submit" className="px-4 py-2 bg-ams-light-blue text-white rounded-md hover:bg-opacity-90">
                        Search
                    </button>
                </form>
                 <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                    Create New Patient
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
                 {loading ? (
                    <div className="flex justify-center items-center p-10">
                        <SpinnerIcon className="w-8 h-8 text-ams-blue dark:text-ams-light-blue" />
                        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Patients...</span>
                    </div>
                 ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date of Birth</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gender</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {patients.map(patient => (
                                    <tr key={patient.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{patient.lastName}, {patient.firstName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-300">{patient.dob}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-gray-300">{patient.gender}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => navigate(`/patients/${patient.id}`)} className="text-ams-light-blue hover:text-ams-blue">View Record</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 )}
                 {!loading && patients.length === 0 && (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        No patients found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Patients;