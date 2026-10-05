// Prints total system power in watts (SMC key PSTR). Reading the SMC needs no root.
#include <IOKit/IOKitLib.h>
#include <stdio.h>
#include <string.h>

typedef struct { char major, minor, build, reserved[1]; UInt16 release; } Vers;
typedef struct { UInt16 version, length; UInt32 cpuPLimit, gpuPLimit, memPLimit; } PLimit;
typedef struct { UInt32 dataSize, dataType; char dataAttributes; } KeyInfo;
typedef struct {
	UInt32 key; Vers vers; PLimit pLimitData; KeyInfo keyInfo;
	char result, status, data8; UInt32 data32; char bytes[32];
} SMCParam;

enum { SMC_HANDLE_EVENT = 2, SMC_READ_BYTES = 5, SMC_READ_KEYINFO = 9 };

static UInt32 fourcc(const char *s) { return (UInt32)s[0] << 24 | s[1] << 16 | s[2] << 8 | s[3]; }

static int call(io_connect_t conn, SMCParam *in, SMCParam *out) {
	size_t size = sizeof(SMCParam);
	return IOConnectCallStructMethod(conn, SMC_HANDLE_EVENT, in, sizeof(SMCParam), out, &size) || out->result;
}

int main(void) {
	io_connect_t conn;
	io_service_t smc = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"));
	if (!smc || IOServiceOpen(smc, mach_task_self(), 0, &conn)) return 1;

	SMCParam in = {0}, out = {0};
	in.key = fourcc("PSTR");
	in.data8 = SMC_READ_KEYINFO;
	if (call(conn, &in, &out) || out.keyInfo.dataType != fourcc("flt ") || out.keyInfo.dataSize != 4) return 2;

	in.keyInfo.dataSize = 4;
	in.data8 = SMC_READ_BYTES;
	if (call(conn, &in, &out)) return 3;

	float watts;
	memcpy(&watts, out.bytes, 4);
	printf("%.2f\n", watts);
	return 0;
}
