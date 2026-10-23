import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.*;import java.security.*;import java.security.cert.X509Certificate;import java.util.*;
public final class SignNativeApk {
 public static void main(String[] args)throws Exception{
  String password=System.getenv("FASTGO_TSD_SIGN_PASSWORD");if(password==null||args.length!=3)throw new IllegalArgumentException("Signing environment or paths missing");
  KeyStore store=KeyStore.getInstance("PKCS12");try(InputStream in=new FileInputStream(args[0])){store.load(in,password.toCharArray());}
  PrivateKey key=(PrivateKey)store.getKey("fastgo-tsd-release",password.toCharArray());
  List<X509Certificate> chain=new ArrayList<>();for(java.security.cert.Certificate c:store.getCertificateChain("fastgo-tsd-release"))chain.add((X509Certificate)c);
  ApkSigner.SignerConfig signer=new ApkSigner.SignerConfig.Builder("fastgo",key,chain).build();
  new ApkSigner.Builder(List.of(signer)).setInputApk(new File(args[1])).setOutputApk(new File(args[2])).setMinSdkVersion(23).setV1SigningEnabled(true).setV2SigningEnabled(true).setV3SigningEnabled(true).setV4SigningEnabled(false).build().sign();
  ApkVerifier.Result result=new ApkVerifier.Builder(new File(args[2])).setMinCheckedPlatformVersion(23).build().verify();
  if(!result.isVerified()||!result.isVerifiedUsingV2Scheme())throw new IllegalStateException("APK verification failed: "+result.getErrors());
  System.out.println("VERIFIED v1="+result.isVerifiedUsingV1Scheme()+" v2="+result.isVerifiedUsingV2Scheme()+" v3="+result.isVerifiedUsingV3Scheme()+" certificate="+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(chain.get(0).getEncoded())));
 }
}
