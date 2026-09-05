export type Toast = { message: string; tone: "success" | "error" | "info" };
export type Notify = (message: string, tone?: Toast["tone"]) => void;
