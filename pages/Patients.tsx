
import React, { useState, useMemo } from 'react';
import type { Patient } from '../types';

const mockPatients: Patient[] = [
    { id: '1', firstName: 'John', lastName: 'Smith', dob: '1985-05-15', gender: 'Male', address: '123 Fake St, Anytown', allergies: 'Penicillin', medications: 'Aspirin', medicalHistory: 'Hypertension' },
    { id: '2', firstName: 'Jane', lastName: 'Doe', dob: '1992-09-20', gender: 'Female', address: '456 Main Ave, Othertown', allergies: 'None', medications: 'None', medicalHistory: 'Asthma' },
    { id: '3', firstName: 'Peter', lastName: 'Jones', dob: '1978-11-01', gender: 'Male', address: '789 Oak Rd, Sometown', allergies: 'Ibuprofen', medications: 'Lisinopril', medicalHistory: 'Type 2 Diabetes' },
    { id: '4', firstName: 'Mary', lastName: 'Williams', dob: '2001-02-25', gender: 'Female', address: '101 Pine Ln, Anycity', allergies: 'None Known', medications: 'Contraceptive Pill', medicalHistory: 'None' },
];

const Patients: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPatients = useMemo(() => {
        return mockPatients.filter(p =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.dob.includes(searchTerm) ||
            (p.nhsNumber && p.nhsNumber.includes(searchTerm))
        );
    }, [searchTerm]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Patient Records</h1>
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white rounded-lg shadow">
                <input
                    type="text"
                    placeholder="Search by name, DOB (YYYY-MM-DD)..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue"
                />
                 <button className="px-4 py-2 bg-ams-blue text-white rounded-md hover:bg-opacity-90">
                    Create New Patient
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-md">
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Birth</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredPatients.map(patient => (
                                <tr key={patient.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{patient.lastName}, {patient.firstName}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{patient.dob}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{patient.gender}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <a href="#" className="text-ams-light-blue hover:text-ams-blue">View Record</a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 {filteredPatients.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        No patients found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Patients;
