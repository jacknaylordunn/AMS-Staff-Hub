import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVehicleById } from '../services/assetService';
import { getKitById } from '../services/inventoryService';
import type { Vehicle, Kit } from '../types';
import { SpinnerIcon } from '../components/icons';

const PrintAsset: React.FC = () => {
    const { assetType, assetId } = useParams<{ assetType: 'vehicle' | 'kit', assetId: string }>();
    const navigate = useNavigate();
    const [asset, setAsset] = useState<Vehicle | Kit | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!assetId || !assetType) {
            setError('Invalid asset information.');
            setLoading(false);
            return;
        }

        const fetchAsset = async () => {
            try {
                let data;
                if (assetType === 'vehicle') {
                    data = await getVehicleById(assetId);
                } else {
                    data = await getKitById(assetId);
                }
                if (data) {
                    setAsset(data);
                } else {
                    setError('Asset not found.');
                }
            } catch (err) {
                setError('Failed to load asset data.');
            } finally {
                setLoading(false);
            }
        };
        fetchAsset();
    }, [assetType, assetId]);

    useEffect(() => {
        if (asset && !loading && !error) {
            // Delay print to ensure images are loaded
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [asset, loading, error]);

    const goBack = () => {
        if (assetType && assetId) {
            navigate(`/inventory/${assetType}/${assetId}`);
        } else {
            navigate('/inventory');
        }
    };

    return (
        <>
            <style>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                }
            `}</style>
            <div className="flex flex-col items-center justify-center min-h-screen bg-white">
                <div className="no-print absolute top-4 left-4">
                    <button onClick={goBack} className="px-4 py-2 bg-gray-200 rounded-md">
                        &larr; Back to Details
                    </button>
                </div>

                {loading && <SpinnerIcon className="w-12 h-12 text-ams-blue" />}
                {error && <p className="text-red-500 font-bold">{error}</p>}
                
                {asset && (
                    <div className="text-center p-8 border-4 border-dashed border-gray-400">
                        <h1 className="text-3xl font-bold mb-2">{asset.name}</h1>
                        {'registration' in asset && <p className="text-xl text-gray-600 mb-4">{asset.registration}</p>}
                        <div className="flex justify-center my-4">
                             <img 
                                id="qr-code-img" 
                                src={`https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(asset.qrCodeValue || '')}&choe=UTF-8`} 
                                alt="Asset QR Code" 
                            />
                        </div>
                        <p className="text-sm text-gray-500 font-mono break-all max-w-xs mx-auto">{asset.qrCodeValue}</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default PrintAsset;