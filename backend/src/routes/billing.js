const express = require("express");
const router = express.Router();

// אם תרצה להחזיר אימות:
// const authenticate = require("../middleware/auth");
// router.use(authenticate);

router.get("/", (req, res) => {
  res.json({ status: "ok", route: "billing" });
});

module.exports = router;
