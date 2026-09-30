export function getHealthStatus(_req, res) {
  res.status(200).json({
    success: true,
    message: "RouteSync API is running",
    data: {
      service: "routesync-server",
      environment: process.env.NODE_ENV ?? "development",
      uptimeInSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
}
