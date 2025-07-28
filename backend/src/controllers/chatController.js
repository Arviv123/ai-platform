const notImplemented = (name) => (req, res) => {
  res.status(501).json({ status: "error", message: `${name} not implemented yet` });
};

module.exports = {
  getSessions: notImplemented("Chat getSessions"),
  getSessionMessages: notImplemented("Chat getSessionMessages"),
  createMessage: notImplemented("Chat createMessage"),
  stream: notImplemented("Chat stream"),
};
