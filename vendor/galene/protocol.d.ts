export type User = {
	username: string;
	permissions: string[];
	data: Record<string, any>;
	streams: Record<string, Record<string, boolean>>;
};

export type Credentials =
	| string
	| { type: 'password'; password: string }
	| { type: 'token'; token: string };

export class ServerConnection {
	id: string;
	group: string | null;
	username: string | null;
	users: Record<string, User>;
	up: Record<string, Stream>;
	down: Record<string, Stream>;
	permissions: string[];
	onconnected: ((this: ServerConnection) => void) | null;
	onerror: ((this: ServerConnection, error: unknown) => void) | null;
	onclose: ((this: ServerConnection, code: number, reason: string) => void) | null;
	onuser: ((this: ServerConnection, id: string, kind: string) => void) | null;
	onjoined:
		| ((
				this: ServerConnection,
				kind: 'join' | 'fail' | 'change' | 'leave' | 'redirect',
				group: string,
				permissions: string[],
				status: Record<string, any>,
				data: Record<string, any>,
				error: string,
				message: string,
		  ) => void)
		| null;
	ondownstream: ((this: ServerConnection, stream: Stream) => void) | null;
	onchat:
		| ((
				this: ServerConnection,
				id: string,
				source: string,
				dest: string,
				username: string,
				time: Date,
				privileged: boolean,
				history: boolean,
				kind: string,
				message: string,
		  ) => void)
		| null;
	onusermessage:
		| ((
				this: ServerConnection,
				id: string | null,
				dest: string,
				username: string,
				time: Date,
				privileged: boolean,
				kind: string,
				error: string,
				message: unknown,
		  ) => void)
		| null;
	connect(url: string): void;
	close(): void;
	join(group: string, username: string | null, credentials: Credentials, data?: Record<string, any>): Promise<void>;
	leave(group: string): void;
	request(what: Record<string, string[]>): void;
	newUpStream(localId?: string): Stream;
	chat(kind: string, dest: string, value: string): void;
	userAction(kind: string, dest: string, value?: unknown): void;
	userMessage(kind: string, dest: string, value?: unknown, noecho?: boolean): void;
	groupAction(kind: string, data?: unknown): void;
}

export class Stream {
	sc: ServerConnection;
	id: string;
	localId: string;
	up: boolean;
	source: string | null;
	username: string | null;
	pc: RTCPeerConnection;
	stream: MediaStream | null;
	label: string | null;
	userdata: Record<string, any>;
	onclose: ((this: Stream, replace: boolean) => void) | null;
	onerror: ((this: Stream, error: unknown) => void) | null;
	ondowntrack: ((this: Stream, track: MediaStreamTrack, transceiver: RTCRtpTransceiver, stream: MediaStream) => void) | null;
	onstatus: ((this: Stream, status: string) => void) | null;
	onstats: ((this: Stream, stats: Record<string, any>) => void) | null;
	setStream(stream: MediaStream): void;
	close(replace?: boolean): void;
	request(what: string[]): void;
	setStatsInterval(ms: number): void;
}
