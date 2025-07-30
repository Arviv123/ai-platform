const notImplemented = (name) => (req, res) => {
  res.status(501).json({ status: "error", message: `${name} not implemented yet` });
};

module.exports = {
  listServers: notImplemented("MCP listServers"),
  getServer: notImplemented("MCP getServer"),
  startServer: notImplemented("MCP startServer"),
  stopServer: notImplemented("MCP stopServer"),
  restartServer: notImplemented("MCP restartServer"),
  executeTool: notImplemented("MCP executeTool"),
  healthCheck: (req, res) => res.json({ status: "ok" }),
};
