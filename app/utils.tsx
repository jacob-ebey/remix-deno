/** @jsx React.createElement */
import * as React from "react";
import { Deferred, useDeferred } from "remix/react";

type DeferredProps = Parameters<typeof Deferred>[0];

interface InlineDeferredProps<Data> extends Omit<DeferredProps, "children"> {
  children: (data: Data) => JSX.Element;
}

export function InlineDeferred<Data>({
  children,
  ...props
}: InlineDeferredProps<Data>) {
  return (
    <Deferred {...props}>
      <ResolveDeferred<Data>>{children}</ResolveDeferred>
    </Deferred>
  );
}

function ResolveDeferred<Data>({
  children,
}: Pick<InlineDeferredProps<Data>, "children">) {
  const data = useDeferred();
  return children(data as Data);
}
