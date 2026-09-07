# Box Lot Market

A US marketplace where people buy and sell box lots, with local pickup or carrier shipping.

## Language

**Box Lot**:
A mixed collection of goods sold as one listing.
_Avoid_: item, lot (alone)

**Parcel**:
One physical package a carrier accepts. The seller sets its weight, length, width, height, and declared value on the Box Lot when they offer shipping.
_Avoid_: box, package

**Shipment**:
The carrier movement created from a bought Envia label. It has a tracking number.
_Avoid_: order, transaction, delivery (alone)

**Postage**:
The Envia rate the buyer pays at checkout, with no seller markup.
_Avoid_: shipping fee, shipping cost

**Delivery method**:
The buyer's choice on an order: carrier shipping or local pickup.
_Avoid_: pickup (alone)

**Local pickup**:
The buyer collects the Box Lot from the seller. There is no Shipment and no Postage.

**Origin address**:
The seller's saved profile street address used as ship-from for rates and labels. It is not the public listing location.

**Shipper of record**:
Box Lot Market. The marketplace holds the Envia account and buys labels.
_Avoid_: seller account, carrier account

**Buyer premium**:
The marketplace fee the buyer pays on the Box Lot price. It does not apply to Postage.
_Avoid_: customer commission, marketplace fee

**Unused label**:
A Shipment the carrier has not scanned. Envia can cancel it and refund Postage to the marketplace Envia balance.
_Avoid_: void, refund (alone)

**Carrier scan**:
The first time the carrier records the Parcel. This marks the order delivered. The buyer sees tracking only after this scan.
_Avoid_: shipped button, mark-delivered

**In-transit order**:
A shipping order after Carrier scan. It is not auto-refunded. An operator handles any cancel.
_Avoid_: delivered (alone)
