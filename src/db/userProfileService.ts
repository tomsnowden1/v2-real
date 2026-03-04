import { db, type UserProfile } from './database';

export function getUserProfile(): Promise<UserProfile | undefined> {
    return db.userProfiles.get('default');
}

export function saveUserProfile(profile: Omit<UserProfile, 'id'>): Promise<string> {
    return db.userProfiles.put({ ...profile, id: 'default' });
}
