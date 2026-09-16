import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";
export function createNotificationPreferenceRouter(service, authService) { const router = Router(); const auth = authenticate(authService); router.get("/notification-preferences", auth, async (req,res,next)=>{try{sendSuccess(res,{data:await service.get(req.auth.user)});}catch(e){next(e);}}); router.put("/notification-preferences", auth, validateRequest(z.object({body:z.object({emailEnabled:z.boolean(),pushEnabled:z.boolean()})})), async(req,res,next)=>{try{sendSuccess(res,{data:await service.save(req.validated.body,req.auth.user)});}catch(e){next(e);}}); return router; }
