import { Router } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getDatabase } from "../config/database.js";
import { AppError } from "../utils/appError.js";

const router = Router();
const allowedRoles = new Set(["employee", "manager", "driver"]);
const now = () => new Date().toISOString();
const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const collection = (name) => getDatabase().collection(name);
const fail = (condition, message, code = 400) => { if (condition) throw new AppError(message, code); };
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

// Requests arrive from the authenticated Next.js server, never directly from a browser.
router.use((req, _res, next) => {
  try {
    const timestamp = req.header("x-route-timestamp");
    const signature = req.header("x-route-signature") || "";
    const identity = req.header("x-route-identity") || "";
    fail(!process.env.API_SHARED_SECRET, "API_SHARED_SECRET is missing", 500);
    fail(!timestamp || Math.abs(Date.now() - Number(timestamp)) > 60_000, "Expired API identity", 401);
    const payload = `${timestamp}.${req.method}.${req.originalUrl}.${identity}.${JSON.stringify(req.body ?? {})}`;
    const expected = createHmac("sha256", process.env.API_SHARED_SECRET).update(payload).digest("hex");
    fail(signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), "Invalid API identity", 401);
    const user = JSON.parse(Buffer.from(identity, "base64url").toString("utf8"));
    fail(!user.id || !allowedRoles.has(user.role), "Access denied", 403);
    req.actor = { id: clean(user.id, 100), name: clean(user.name, 100), email: clean(user.email, 150).toLowerCase(), role: user.role };
    next();
  } catch (error) { next(error); }
});
const manager = (req, _res, next) => req.actor.role === "manager" ? next() : next(new AppError("Manager access required", 403));
const employee = (req, _res, next) => req.actor.role === "employee" ? next() : next(new AppError("Employee access required", 403));
const driver = (req, _res, next) => req.actor.role === "driver" ? next() : next(new AppError("Driver access required", 403));

router.get("/requests", wrap(async (req, res) => {
  const query = req.actor.role === "employee" ? { employeeId: req.actor.id } : {};
  fail(req.actor.role === "driver", "Access denied", 403);
  res.json({ success: true, data: await collection("tripRequests").find(query, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray() });
}));
router.post("/requests", employee, wrap(async (req, res) => {
  const { pickup, destination, date, departure, purpose, type, passengers, emergency, solo, details } = req.body;
  fail(!clean(pickup) || !clean(destination) || !clean(date) || !clean(departure) || !clean(purpose), "Pickup, destination, date, departure and purpose are required");
  fail(clean(pickup).toLowerCase() === clean(destination).toLowerCase(), "Pickup and destination must differ");
  fail(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`)), "Invalid date");
  const count = Number(passengers);
  fail(!Number.isInteger(count) || count < 1 || count > 40, "Passengers must be between 1 and 40");
  const item = { id: `RQ-${randomUUID().slice(0, 8).toUpperCase()}`, employeeId: req.actor.id, employee: req.actor.name, employeeEmail: req.actor.email, pickup: clean(pickup), destination: clean(destination), route: `${clean(pickup)} → ${clean(destination)}`, date: clean(date), departure: clean(departure, 50), time: clean(departure, 50), purpose: clean(purpose), type: clean(type || purpose), passengers: count, emergency: Boolean(emergency), solo: Boolean(solo), details: details && typeof details === "object" && !Array.isArray(details) ? { returnTime: clean(details.returnTime, 50), hasLuggage: Boolean(details.hasLuggage), luggageDetails: clean(details.luggageDetails), emergencyReason: clean(details.emergencyReason), authorization: clean(details.authorization), flightNumber: clean(details.flightNumber, 50), flightTime: clean(details.flightTime, 50) } : {}, priority: emergency ? "Critical" : "Normal", status: emergency ? "Priority review" : "Pending", createdAt: now() };
  await collection("tripRequests").insertOne(item);
  res.status(201).json({ success: true, data: item });
}));
router.patch("/requests/:id/decision", manager, wrap(async (req, res) => {
  const { status, reason } = req.body;
  fail(!["Approved", "Rejected"].includes(status), "Choose Approved or Rejected");
  fail(status === "Rejected" && !clean(reason), "A rejection reason is required");
  const result = await collection("tripRequests").findOneAndUpdate({ id: req.params.id, status: { $in: ["Pending", "Priority review"] } }, { $set: { status, rejectionReason: status === "Rejected" ? clean(reason) : "", decidedAt: now(), decidedBy: req.actor.id } }, { returnDocument: "after", projection: { _id: 0 } });
  fail(!result, "Request is unavailable or already decided", 409);
  res.json({ success: true, data: result });
}));
router.get("/vehicles", manager, wrap(async (_req, res) => res.json({ success: true, data: await collection("vehicles").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray() })));
router.post("/vehicles", manager, wrap(async (req, res) => {
  const name = clean(req.body.name), plate = clean(req.body.plate);
  const seats = Number(req.body.seats);
  fail(!name || !plate || !Number.isInteger(seats) || seats < 1, "Vehicle name, plate and seats are required");
  fail(await collection("vehicles").findOne({ plate }), "Plate already registered", 409);
  const item = { id: `VH-${randomUUID().slice(0, 8).toUpperCase()}`, name, plate, seats, status: "Available", createdAt: now() };
  await collection("vehicles").insertOne(item);
  res.status(201).json({ success: true, data: item });
}));
router.get("/drivers", manager, wrap(async (_req, res) => res.json({ success: true, data: await collection("drivers").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray() })));
router.post("/drivers", manager, wrap(async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  fail(!email || !clean(req.body.name) || !clean(req.body.phone), "Driver name, email and phone are required");
  const user = await collection("user").findOne({ email, role: "driver" });
  fail(!user, "This email must belong to a Better Auth account with driver role", 400);
  fail(await collection("drivers").findOne({ userId: user._id.toString() }), "Driver already added", 409);
  const item = { id: `DR-${randomUUID().slice(0, 8).toUpperCase()}`, userId: user._id.toString(), name: clean(req.body.name), email, phone: clean(req.body.phone), status: "Available", createdAt: now() };
  await collection("drivers").insertOne(item);
  res.status(201).json({ success: true, data: item });
}));
router.get("/trips", wrap(async (req, res) => {
  const query = req.actor.role === "employee" ? { employeeIds: req.actor.id } : req.actor.role === "driver" ? { driverUserId: req.actor.id } : {};
  res.json({ success: true, data: await collection("trips").find(query, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray() });
}));
router.post("/trips", manager, wrap(async (req, res) => {
  const ids = [...new Set(Array.isArray(req.body.requestIds) ? req.body.requestIds.map((id) => clean(id, 60)) : [])];
  fail(!ids.length || !clean(req.body.vehicleId) || !clean(req.body.driverId), "Choose requests, a vehicle and a driver");
  const requests = await collection("tripRequests").find({ id: { $in: ids }, status: "Approved", tripId: { $exists: false } }).toArray();
  fail(requests.length !== ids.length, "All requests must be approved and unassigned", 409);
  const date = requests[0].date;
  fail(requests.some((item) => item.date !== date), "Requests must have the same date");
  fail(requests.length > 1 && requests.some((item) => item.solo || item.emergency), "Solo and emergency requests need a separate trip", 409);
  const vehicle = await collection("vehicles").findOne({ id: req.body.vehicleId, status: "Available" });
  const assignedDriver = await collection("drivers").findOne({ id: req.body.driverId, status: "Available" });
  fail(!vehicle || !assignedDriver, "Vehicle or driver unavailable", 409);
  fail(requests.reduce((sum, item) => sum + item.passengers, 0) > vehicle.seats, "Vehicle has too few seats", 409);
  const busy = await collection("trips").findOne({ date, status: { $nin: ["Completed", "Cancelled"] }, $or: [{ vehicleId: vehicle.id }, { driverId: assignedDriver.id }] });
  fail(busy, "Vehicle or driver already has a trip on this date", 409);
  const item = { id: `RT-${randomUUID().slice(0, 8).toUpperCase()}`, requestIds: ids, employeeIds: requests.map((r) => r.employeeId), route: requests.map((r) => r.route).join(" | "), date, departure: clean(req.body.departure || requests[0].departure, 50), passengers: requests.reduce((sum, r) => sum + r.passengers, 0), vehicleId: vehicle.id, vehicle: vehicle.name, plate: vehicle.plate, driverId: assignedDriver.id, driverUserId: assignedDriver.userId, driver: assignedDriver.name, driverPhone: assignedDriver.phone, status: "Scheduled", createdAt: now() };
  const result = await collection("tripRequests").updateMany({ id: { $in: ids }, status: "Approved", tripId: { $exists: false } }, { $set: { tripId: item.id, status: "Assigned" } });
  fail(result.modifiedCount !== ids.length, "Requests changed during assignment", 409);
  try { await collection("trips").insertOne(item); }
  catch (error) { await collection("tripRequests").updateMany({ id: { $in: ids }, tripId: item.id }, { $unset: { tripId: "" }, $set: { status: "Approved" } }); throw error; }
  res.status(201).json({ success: true, data: item });
}));
router.patch("/trips/:id/status", driver, wrap(async (req, res) => {
  const next = { Scheduled: "Driver accepted", "Driver accepted": "In progress", "In progress": "Completed" };
  const trip = await collection("trips").findOne({ id: req.params.id, driverUserId: req.actor.id });
  fail(!trip, "Assigned trip not found", 404);
  fail(next[trip.status] !== req.body.status, "Invalid status transition", 409);
  const updated = await collection("trips").findOneAndUpdate({ id: trip.id, driverUserId: req.actor.id, status: trip.status }, { $set: { status: req.body.status, updatedAt: now() } }, { returnDocument: "after", projection: { _id: 0 } });
  fail(!updated, "Trip changed. Refresh and try again", 409);
  if (updated.status === "Completed") await collection("tripRequests").updateMany({ tripId: trip.id }, { $set: { status: "Completed" } });
  res.json({ success: true, data: updated });
}));
export default router;
