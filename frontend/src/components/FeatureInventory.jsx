import { featureInventoryView } from "@/lib/featureInventoryPresentation.mjs";

const statusClasses = {
  COMPLETED: "border-teal-200/25 bg-teal-200/5 text-teal-100",
  PARTIAL: "border-amber-200/25 bg-amber-200/5 text-amber-100",
  NOT_SUBMITTED: "border-white/15 text-[#F0E9D6]/65",
};

export default function FeatureInventory({ result }) {
  const view = featureInventoryView(result);
  return (
    <section aria-labelledby="feature-inventory-heading" data-testid="feature-inventory" className="mt-6 rounded-2xl border border-teal-200/20 bg-[#202027] p-6 sm:p-8">
      <div className="eyebrow">Analysis feature inventory</div>
      <h2 id="feature-inventory-heading" className="mt-2 text-xl font-semibold text-[#F0E9D6]">The six checks in this scan</h2>
      <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/75">{view.description}</p>
      {!view.fullyReported && (
        <p className="mt-3 text-xs leading-5 text-amber-100">Some per-feature execution evidence was not recorded or could not be read. A new scan is needed to record those statuses.</p>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[650px] border-separate border-spacing-y-2 text-left text-xs">
          <caption className="sr-only">Execution status and completed comparisons for each analysis feature</caption>
          <thead className="font-mono-data text-[10px] uppercase tracking-widest text-[#F0E9D6]/65">
            <tr><th scope="col" className="px-3 py-2">Channel / component</th><th scope="col" className="px-3 py-2">Execution</th><th scope="col" className="px-3 py-2">Completed comparisons</th></tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.id} data-feature-id={row.id} className="bg-[#17171C] align-top text-[#F0E9D6]/75">
                <th scope="row" className="rounded-l-xl px-3 py-4 font-normal">
                  <div className="text-[10px] uppercase tracking-wide text-[#F0E9D6]/65">{row.channel}</div>
                  <div className="mt-1 text-sm font-medium text-[#F0E9D6]">{row.label}</div>
                  {row.inputRequirement && <div className="mt-2 leading-5">Input: {row.inputRequirement}</div>}
                  {row.limitation && <div className="mt-2 max-w-xl leading-5 text-[#F0E9D6]/65">{row.limitation}</div>}
                </th>
                <td className="px-3 py-4"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 ${statusClasses[row.status] || "border-amber-200/25 text-amber-100"}`}>{row.statusLabel}</span></td>
                <td className="rounded-r-xl px-3 py-4 font-mono-data">{row.countLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#F0E9D6]/70">Completed means the check ran. It does not establish a match or recognition accuracy. Counts belong to each check and must not be added into a unique catalogue total.</p>
    </section>
  );
}
