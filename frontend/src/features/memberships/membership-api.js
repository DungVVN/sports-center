import { apiClient } from "../../api/client.js";
export const membershipApi=Object.freeze({packages:()=>apiClient.get("/membership-packages"),create:(memberId,input)=>apiClient.post(`/members/${memberId}/memberships`,input),byMember:(memberId)=>apiClient.get(`/members/${memberId}/memberships`)});
