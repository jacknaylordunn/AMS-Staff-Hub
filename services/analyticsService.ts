import { db } from './firebase';
import type { UserAnalytics } from '../types';

export const getStaffAnalytics = async (): Promise<UserAnalytics[]> => {
    const snapshot = await db.collection('userAnalytics').orderBy('totalHours', 'desc').get();
    return snapshot.docs.map(doc => ({ ...doc.data() } as UserAnalytics));
};
