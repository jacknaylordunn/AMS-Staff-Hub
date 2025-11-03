
import React, { useState, useMemo } from 'react';
import type { Document } from '../types';

const mockDocuments: Document[] = [
    { id: 'sop001', title: 'Clinical Patient Assessment', category: 'SOP', url: '#', version: '3.1' },
    { id: 'sop002', title: 'Medication Administration', category: 'SOP', url: '#', version: '2.5' },
    { id: 'guide001', title: 'Anaphylaxis Management', category: 'Guideline', url: '#', version: '4.0' },
    { id: 'guide002', title: 'Sepsis Recognition', category: 'Guideline', url: '#', version: '2.2' },
    { id: 'proc001', title: 'Major Incident Declaration', category: 'Procedure', url: '#', version: '1.8' },
    { id: 'proc002', title: 'Infection Prevention and Control', category: 'Procedure', url: '#', version: '5.2' },
    { id: 'sop003', title: 'Airway Management and Suction', category: 'SOP', url: '#', version: '3.3' },
    { id: 'guide003', title: 'Post-Resuscitation Care', category: 'Guideline', url: '#', version: '1.5' }
];

const Documents: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'SOP' | 'Guideline' | 'Procedure'>('all');

    const filteredDocuments = useMemo(() => {
        return mockDocuments
            .filter(doc => filter === 'all' || doc.category === filter)
            .filter(doc => doc.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, filter]);

    const getCategoryColor = (category: Document['category']) => {
        switch (category) {
            case 'SOP': return 'bg-blue-100 text-blue-800';
            case 'Guideline': return 'bg-green-100 text-green-800';
            case 'Procedure': return 'bg-yellow-100 text-yellow-800';
        }
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Documents Library</h1>
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white rounded-lg shadow">
                <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:ring-ams-light-blue focus:border-ams-light-blue"
                />
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value as any)}
                    className="w-full md:w-auto px-4 py-2 border rounded-md bg-white focus:ring-ams-light-blue focus:border-ams-light-blue"
                >
                    <option value="all">All Categories</option>
                    <option value="SOP">SOPs</option>
                    <option value="Guideline">Guidelines</option>
                    <option value="Procedure">Procedures</option>
                </select>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredDocuments.map(doc => (
                        <li key={doc.id}>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-gray-50">
                                <div className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-md font-medium text-ams-blue truncate">{doc.title}</p>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(doc.category)}`}>
                                                {doc.category}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex">
                                            <p className="flex items-center text-sm text-gray-500">
                                                Version: {doc.version}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        </li>
                    ))}
                </ul>
                {filteredDocuments.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        No documents found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Documents;
