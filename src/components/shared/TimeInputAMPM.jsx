import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TimeInputAMPM({ value, onChange, label }) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [period, setPeriod] = useState("AM");

  // Convert 24-hour format (HH:MM) to 12-hour format
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      let hour = parseInt(h);
      const min = m;
      const newPeriod = hour >= 12 ? "PM" : "AM";
      if (hour > 12) hour -= 12;
      if (hour === 0) hour = 12;
      setHours(hour.toString());
      setMinutes(min);
      setPeriod(newPeriod);
    } else {
      setHours("");
      setMinutes("");
      setPeriod("AM");
    }
  }, [value]);

  // Convert 12-hour format to 24-hour format and send to parent
  const updateValue = (h, m, p) => {
    if (h && m) {
      let hour = parseInt(h);
      if (p === "PM" && hour !== 12) hour += 12;
      if (p === "AM" && hour === 12) hour = 0;
      const time24 = `${hour.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      onChange(time24);
    } else {
      onChange(""); // Clear time if either field is empty
    }
  };

  const handleHourChange = (e) => {
    const h = e.target.value;
    setHours(h);
    updateValue(h, minutes, period);
  };

  const handleMinuteChange = (e) => {
    const m = e.target.value;
    setMinutes(m);
    updateValue(hours, m, period);
  };

  const handlePeriodChange = (p) => {
    setPeriod(p);
    updateValue(hours, minutes, p);
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-sm block mb-1">Hour</label>
        <Input
          type="number"
          min="1"
          max="12"
          value={hours}
          onChange={handleHourChange}
          placeholder="1-12"
          className="rounded-xl"
        />
      </div>
      <div className="flex-1">
        <label className="text-sm block mb-1">Minute</label>
        <Input
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={handleMinuteChange}
          placeholder="00-59"
          className="rounded-xl"
        />
      </div>
      <div className="flex-1">
        <label className="text-sm block mb-1">Period</label>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}