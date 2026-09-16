import { Router } from "express";
import { authenticate } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
export function createAiAssistRouter(service, authService) { const router = Router(); router.get("/ai-assist/suggestions", authenticate(authService), async (req,res,next)=>{try{sendSuccess(res,{data:await service.suggestions(req.auth.user)});}catch(e){next(e);}}); return router; }
