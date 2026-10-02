export function operationNotificationMiddleware(service, apiBasePath) {
  return (request, response, next) => {
    response.locals.beforeSuccess = async (result) => {
      if (!request.originalUrl.startsWith(`${apiBasePath}/`)) return;
      await service.record({ method: request.method, path: request.originalUrl.split("?")[0].slice(apiBasePath.length), actor: request.auth?.user, result });
    };
    next();
  };
}
