import React from "react";

export function Dropdown() {
  const handlers = {};

  handlers.onClick = () => console.log("Foo");

  return React.createElement("div", null, {
    id: "foo",
    onClick: handlers.onClick,
  });
}
