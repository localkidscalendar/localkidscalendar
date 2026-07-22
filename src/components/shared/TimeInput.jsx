import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TimeInput({ value, onChange }) {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("AM");

  // Parse 24-hour format (HH:MM) and display as 12-hour
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      let hour24 = parseInt(h);
      const newPeriod = hour24 >= 12 ? "PM" : "AM";
      let hour12 = hour24;
      if (hour12 > 12) hour12 -= 12;
      if (hour12 === 0) hour12 = 12;
      setHour(hour12.toString());
      setMinute(m);
      setPeriod(newPeriod);
    } else {
      setHour("");
      setMinute("00");
      setPeriod("AM");
    }
  }, [value]);

  // Convert 12-hour to 24-hour and send to parent
  const updateValue = (h, m, p) => {
    if (h && m) {
      let hour24 = parseInt(h);
      if (p === "PM" && hour24 !== 12) hour24 += 12;
      if (p === "AM" && hour24 === 12) hour24 = 0;
      const time24 = `${hour24.toString().padStart(2, "0")}:${m}`;
      onChange(time24);
    } else {
      onChange("");
    }
  };

  const handleHourChange = (h) => {
    setHour(h);
    updateValue(h, minute, period);
  };

  const handleMinuteChange = (m) => {
    setMinute(m);
    updateValue(hour, m, period);
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    updateValue(hour, minute, p);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  return (
    <div className="flex gap-2 items-end">
      <Select value={hour} onValueChange={handleHourChange}>
        <SelectTrigger className="rounded-xl w-16">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={minute} onValueChange={handleMinuteChange}>
        <SelectTrigger className="rounded-xl w-16">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="rounded-xl w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}