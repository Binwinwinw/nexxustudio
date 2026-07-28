export function getReadinessUi(status = "starting") {
  switch (status) {
    case "ready":
      return {
        label: "Systeme pret",
        toneClass: "text-emerald-400",
        badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      };
    case "degraded":
      return {
        label: "Mode degrade",
        toneClass: "text-amber-400",
        badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
    default:
      return {
        label: "Bootstrap",
        toneClass: "text-slate-500",
        badgeClass: "bg-blue-500/10 text-blue-300 border-blue-500/20",
      };
  }
}
