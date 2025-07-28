const notImplemented = (name) => (req, res) => {
  res.status(501).json({ status: "error", message: `${name} not implemented yet` });
};

module.exports = {
  getProfile: notImplemented("User getProfile"),
  updateProfile: notImplemented("User updateProfile"),
  listUsers: notImplemented("User listUsers"),
};
