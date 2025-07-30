const notImplemented = (name) => (req, res) => {
  res.status(501).json({ status: "error", message: `${name} not implemented yet` });
};

module.exports = {
  createCheckout: notImplemented("Billing createCheckout"),
  webhook: notImplemented("Billing webhook"),
  getInvoices: notImplemented("Billing getInvoices"),
};
