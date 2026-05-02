import React from "react";

interface PrintOutboundReceiptProps {
  order: any;
  items: any[];
}

export default function PrintOutboundReceipt({ order, items }: PrintOutboundReceiptProps) {
  const currentDate = new Date();

  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white text-black p-8 font-sans">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-xl font-bold uppercase">Công ty TNHH Taika Seafood</h1>
          <p className="text-sm">Địa chỉ: Lô N, Khu công nghiệp An Nghiệp, xã An Ninh, thành phố Cần Thơ, Việt Nam</p>
          <p className="text-sm">Điện thoại: 0913103660</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg mb-1">Mẫu số: 02 - VT</p>
          <p className="text-xs italic">(Ban hành theo Thông tư số 200/2014/TT-BTC)</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold uppercase mb-2">Phiếu Xuất Kho</h2>
        <p className="text-sm italic">
          Ngày {currentDate.getDate()} tháng {currentDate.getMonth() + 1} năm {currentDate.getFullYear()}
        </p>
        <p className="text-sm mt-1">Số: <span className="font-bold">{order.id.split('-')[0].toUpperCase()}</span></p>
      </div>

      {/* Info */}
      <div className="mb-6 space-y-2 text-sm">
        <p>- Họ tên người nhận hàng: <span className="font-bold">{order.customer_name || "..................................................."}</span></p>
        <p>- Địa chỉ (bộ phận nhận): <span className="font-bold">{order.shipping_address || "Giao tại xưởng"}</span></p>
        <p>- Lý do xuất kho: <span className="font-bold">{order.notes || "Bán hàng"}</span></p>
        <p>- Xuất tại kho: <span className="font-bold">Kho Taika</span></p>
      </div>

      {/* Table */}
      <table className="w-full border-collapse border border-black text-sm mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-2 w-12 text-center">STT</th>
            <th className="border border-black p-2 text-left">Tên, nhãn hiệu, quy cách phẩm chất vật tư</th>
            <th className="border border-black p-2 text-center w-24">Mã số</th>
            <th className="border border-black p-2 text-center w-24">Số lô</th>
            <th className="border border-black p-2 text-center w-16">ĐVT</th>
            <th className="border border-black p-2 text-center w-28">Số lượng xuất</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-black p-2 text-center">{idx + 1}</td>
              <td className="border border-black p-2 text-left font-medium">{item.products?.name}</td>
              <td className="border border-black p-2 text-center">{item.products?.sku}</td>
              <td className="border border-black p-2 text-center">{item.batches?.lot_number || "-"}</td>
              <td className="border border-black p-2 text-center">{item.products?.uoms?.abbreviation || "kg"}</td>
              <td className="border border-black p-2 text-center font-bold">
                {item.quantity_allocated || item.quantity || 0}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="border border-black p-4 text-center text-gray-500">
                Không có chi tiết sản phẩm
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={5} className="border border-black p-2 text-right font-bold">Cộng:</td>
            <td className="border border-black p-2 text-center font-bold">
              {order.total_quantity || items.reduce((s: number, i: any) => s + Number(i.quantity_allocated || i.quantity || 0), 0)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer Signatures */}
      <div className="flex justify-between text-center mt-12 text-sm pb-16">
        <div className="flex-1">
          <p className="font-bold">Người lập phiếu</p>
          <p className="italic text-xs mb-16">(Ký, họ tên)</p>
          <p className="font-semibold">{order.creator_name || "........................"}</p>
        </div>
        <div className="flex-1">
          <p className="font-bold">Người nhận hàng</p>
          <p className="italic text-xs mb-16">(Ký, họ tên)</p>
          <p className="font-semibold">........................</p>
        </div>
        <div className="flex-1">
          <p className="font-bold">Thủ kho</p>
          <p className="italic text-xs mb-16">(Ký, họ tên)</p>
          <p className="font-semibold">........................</p>
        </div>
      </div>
    </div>
  );
}
