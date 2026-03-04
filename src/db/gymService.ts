import { db, type GymProfile, type CustomEquipmentItem } from '../db/database';

export function getAllGyms(): Promise<GymProfile[]> {
    return db.gymProfiles.toArray();
}

export function getGymById(id: string): Promise<GymProfile | undefined> {
    return db.gymProfiles.get(id);
}

export function addGym(gym: GymProfile): Promise<string> {
    return db.gymProfiles.add(gym);
}

export function updateGym(id: string, modifications: Partial<GymProfile>) {
    return db.gymProfiles.update(id, modifications);
}

export function deleteGym(id: string) {
    return db.gymProfiles.delete(id);
}

/** Add a user-defined custom equipment item to a gym, and auto-select it. */
export async function addCustomEquipment(gymId: string, item: CustomEquipmentItem): Promise<void> {
    const gym = await getGymById(gymId);
    if (!gym) return;

    const updatedCustom = [...(gym.customEquipment ?? []), item];
    const updatedSelected = [...gym.availableEquipmentIds, item.id];
    await updateGym(gymId, {
        customEquipment: updatedCustom,
        availableEquipmentIds: updatedSelected,
    });
}

/** Remove a user-defined custom equipment item from a gym. */
export async function removeCustomEquipment(gymId: string, itemId: string): Promise<void> {
    const gym = await getGymById(gymId);
    if (!gym) return;

    const updatedCustom = (gym.customEquipment ?? []).filter(e => e.id !== itemId);
    const updatedSelected = gym.availableEquipmentIds.filter(id => id !== itemId);
    await updateGym(gymId, {
        customEquipment: updatedCustom,
        availableEquipmentIds: updatedSelected,
    });
}
