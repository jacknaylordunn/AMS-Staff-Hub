import type { User } from '../types';

const roleHierarchy: Record<Exclude<User['role'], 'Pending' | 'Welfare' | 'Admin' | 'Manager' | undefined>, number> = {
    'First Aider': 1,
    'FREC3': 2,
    'FREC4/ECA': 3,
    'FREC5/EMT/AAP': 4,
    'Paramedic': 5,
    'Nurse': 6,
    'Doctor': 7,
};

export const isRoleOrHigher = (userRole: User['role'], requiredRole: User['role']): boolean => {
    if (!userRole || !requiredRole) return false;
    
    // Admins and Managers can do any clinical role
    if (userRole === 'Admin' || userRole === 'Manager') return true;

    // Welfare is a separate track, only matches itself
    if (requiredRole === 'Welfare') return userRole === 'Welfare';
    if (userRole === 'Welfare') return false;
    if(requiredRole === 'Pending' || userRole === 'Pending') return false;


    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy];
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy];

    if (userLevel === undefined || requiredLevel === undefined) return false;

    return userLevel >= requiredLevel;
};

export const ALL_ROLES: User['role'][] = ['Pending', 'First Aider', 'FREC3', 'FREC4/ECA', 'FREC5/EMT/AAP', 'Paramedic', 'Nurse', 'Doctor', 'Welfare', 'Admin', 'Manager'];
