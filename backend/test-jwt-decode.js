// Temporary test to decode JWT and see what's inside
import jwt from "jsonwebtoken";

// Simulate the same token generation as in the service
const testPayload = {
  id: 1,
  username: "test",
  email: "test@test.com",
  tenant_id: 1,
  tenantId: 1,
  role: "admin",
  activeRole: "employee",
  isRoleSwitched: true,
  type: "access",
};

const token = jwt.sign(
  testPayload,
  process.env.JWT_SECRET || "schneeseekleerehfeedrehzehwehtee",
);
console.log("Generated token:", token);

const decoded = jwt.decode(token);
console.log("\nDecoded token:", JSON.stringify(decoded, null, 2));

// Check specific fields
console.log("\nisRoleSwitched field:", decoded.isRoleSwitched);
console.log("Type of isRoleSwitched:", typeof decoded.isRoleSwitched);
