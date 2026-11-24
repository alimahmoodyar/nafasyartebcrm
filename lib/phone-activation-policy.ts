import type {Session} from './permissions';
import {canGenerateActivationCode} from './activation-code-access';

export const phoneActivationProfiles = ['home-service-customer-support','home-service'] as const;
export const isPhoneActivationProfile = (id:string) => phoneActivationProfiles.some(profile=>profile===id);

export function canOpenPhoneActivation(user:Session,assigned=user.assignedProfileIds||[]):boolean {
 if(user.rolePreview||!canGenerateActivationCode(user))return false;
 if(user.isAdmin)return true;
 if(!user.permissions.serviceDomains?.includes('home')||!user.permissions.serviceRoles?.includes('support'))return false;
 return user.profileReview?isPhoneActivationProfile(user.profileReview.id):assigned.some(isPhoneActivationProfile);
}
